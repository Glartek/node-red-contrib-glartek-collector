module.exports = function(RED) {
    'use strict';

    const path = require('path');
    const fs = require('fs');
    const mqtt = require('mqtt'),
    NeDBStore = require('mqtt-nedb-store');

    function GlartekCollectorNode(config) {
        const node = this;

        RED.nodes.createNode(node, config);

        node.status({});

        // Log current configurations
        console.log('glartek-collector: config.broker (' + config.broker + ')');
        console.log('glartek-collector: config.id  (' + config.id + ')');
        console.log('glartek-collector: config.topic (' + config.topic + ')');

        const options = {
            keepalive: 10,
            clientId: config.id,
            clean: true,
            connectTimeout: 5 * 1000,
            queueQoSZero: false,
        };

        if (config.username && config.password) {
            options.username = config.username;
            options.password = config.password;
        }

        if (config.tls) {
            options.rejectUnauthorized = true;
            options.ca = config.tlsca || '';
            options.key = config.tlspriv || '';
            options.cert = config.tlscert || '';
            //options.protocol = 'mqtts';
        }

        if (config.store) {
            // Prepare directory for MQTT Store
            const mqttStoreDir = path.join(RED.settings.userDir, 'glartek-collector/mqtt');

            try {
                if (!fs.existsSync(mqttStoreDir)) {
                    console.log('glartek-collector: Trying to create directory on ', mqttStoreDir);

                    // Create MQTT Store directory
                    fs.mkdirSync(mqttStoreDir, { recursive: true });

                    console.log('glartek-collector: Directory created on ', mqttStoreDir);
                }

                // HACK: For some reason it is expecting incoming~ and outgoing~ to exist
                fs.closeSync(fs.openSync(mqttStoreDir + 'incoming~', 'w'))
                fs.closeSync(fs.openSync(mqttStoreDir + 'outgoing~', 'w'))
            }
            catch (e) {
                node.error(e);
            }

            // Enable MQTT Store
            const manager = NeDBStore(mqttStoreDir);
            
            manager.incoming.db.persistence.setAutocompactionInterval(60 * 1000);
            manager.outgoing.db.persistence.setAutocompactionInterval(60 * 1000);

            options.incomingStore = manager.incoming;
            options.outgoingStore = manager.outgoing;
            
        }

        // Define functions
        this.users = {};

        this.connect = function () {
            if (!node.connected && !node.connecting) {
                node.connecting = true;
                try {
                    const client = mqtt.connect(config.broker, options)
                    node.client = client

                    client.on('connect', function () {
                        node.connecting = false;
                        node.connected = true;
                        node.log(
                            RED._(
                                'mqtt.state.connected', 
                                { broker: ( node.clientid ? node.clientid + '@': '') + node.brokerurl } 
                            )
                        );
                        for (var id in node.users) {
                            if (node.users.hasOwnProperty(id)) {
                                node.users[id].status({
                                    fill: 'green',
                                    shape: 'dot',
                                    text: 'node-red:common.status.connected'
                                });
                            }
                        }
                    });

                    client.on('reconnect', function() {
                        node.connected = false;
                        node.connecting = true;

                        for (var id in node.users) {
                            if (node.users.hasOwnProperty(id)) {
                                node.users[id].status({
                                    fill: 'yellow',
                                    shape: 'ring',
                                    text: 'node-red:common.status.connecting'
                                });
                            }
                        }
                    });

                    // Register disconnect handlers
                    client.on('close', function (removed, done) {
                        if (node.connected) {
                            node.connected = false;
                            node.log(
                                RED._(
                                    'mqtt.state.disconnected', 
                                    { broker: (node.clientid ? node.clientid+'@':'') + node.brokerurl } 
                                )
                            );
                            for (var id in node.users) {
                                if (node.users.hasOwnProperty(id)) {
                                    node.users[id].status({
                                        fill: 'red',
                                        shape: 'ring',
                                        text: 'node-red:common.status.disconnected'
                                    });
                                }
                            }
                        } else if (node.connecting) {
                            node.log(RED._('mqtt.state.connect-failed', { broker: ( node.clientid ? node.clientid + '@' : '') + node.brokerurl } ));
                        }

                        node.deregister(node, done);
                    });

                    client.on('error', function(error) {
                        node.error(error);
                    });

                    client.on('disconnect', function () {
                        client.stream.end()
                    });

                    node.on('input', function(msg) {
                        if (!client.connected) {
                            return
                        }

                        if (msg.payload && typeof msg.payload === 'object') {
                            client.publish(config.topic, JSON.stringify([msg.payload]), { qos: 1 });
                        }
                    });

                } catch(err) {
                    console.log(err);
                }
            }
        };

        this.register = function(mqttNode) {
            node.users[mqttNode.id] = mqttNode;
            if (Object.keys(node.users).length === 1) {
                node.connect();
            }
        };

        this.deregister = function(mqttNode) {
            delete node.users[mqttNode.id];
            if (Object.keys(node.users).length === 0) {
                node.client.end();
                return
            }
            return
        };

        node.register(this);
    }

    RED.nodes.registerType('glartek-collector', GlartekCollectorNode);
}
