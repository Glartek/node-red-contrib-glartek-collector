module.exports = function(RED) {
    'use strict';

    const path = require('path');
    const fs = require('fs');
    const mqtt = require('mqtt'),
    NeDBStore = require('mqtt-nedb-store');

    // Node status connected
    const statusConnected = {
        fill: 'green',
        shape: 'dot',
        text: 'node-red:common.status.connected'
    }

    // Node status disconnected
    const statusDisconnected = {
        fill: 'red',
        shape: 'ring',
        text: 'node-red:common.status.disconnected'
    }

    // Node status reconnection
    const statusReconnect = {
        fill: 'yellow',
        shape: 'ring',
        text: 'node-red:common.status.connecting'
    }

    function GlartekCollectorNode(config) {
        const node = this;

        RED.nodes.createNode(node, config);

        // Clear node status
        node.status({});

        // Log current configurations
        console.log('glartek-collector: config.broker (' + config.broker + ')');
        console.log('glartek-collector: config.clientid (' + config.clientid + ')');
        console.log('glartek-collector: config.topic (' + config.topic + ')');

        const options = {
            keepalive: 10,
            clientId: config.clientid,
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

        // Define functions
        this.users = {};

        this.connect = function () {
            if (!node.connected && !node.connecting) {
                node.connecting = true;

                try {
                    const client = mqtt.connect(config.broker, options)
                    node.client = client

                    // On mqtt connect
                    node.client.on('connect', function () {
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
                                node.users[id].status(statusConnected);
                            }
                        }
                    });

                    // On mqtt reconnect
                    node.client.on('reconnect', function() {
                        node.connected = false;
                        node.connecting = true;

                        for (var id in node.users) {
                            if (node.users.hasOwnProperty(id)) {
                                node.users[id].status(statusReconnect);
                            }
                        }
                    });

                    node.client.on('close', function() {
                         // Is connection up?
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
                                    node.users[id].status(statusDisconnected);
                                }
                            }
                        // Is connecting?    
                        }
                        
                        if (node.connecting) {
                            node.log(
                                RED._(
                                    'mqtt.state.connect-failed', 
                                    { broker: ( node.clientid ? node.clientid + '@' : '') + node.brokerurl } 
                                )
                            );
                        }
                    });

                    // On mqtt close
                    node.on('close', function (done) {
                        // Deregister
                        node.deregister(node, done);
                    });

                    // On mqtt error
                    node.client.on('error', function(error) {
                        node.error(error);
                    });

                    // On mqtt disconnect
                    node.client.on('disconnect', function () {
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

        // Register node
        this.register = function(mqttNode) {
            node.users[mqttNode.id] = mqttNode;
            if (Object.keys(node.users).length === 1) {
                node.connect();
            }
        };

        // DeRegister node
        this.deregister = function(mqttNode, done) {
            delete node.users[mqttNode.id];
            if (node.closing) {
                return done();
            }
            if (Object.keys(node.users).length === 0) {
                if (node.client && node.client.connected) {
                    return node.client.end(done);
                } else {
                    node.client.end();
                    return done();
                }
            }

            done();
        };

        node.register(this);
    }

    RED.nodes.registerType('glartek-collector', GlartekCollectorNode);
}
