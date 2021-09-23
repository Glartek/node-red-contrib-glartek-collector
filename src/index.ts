'use strict';

import mqtt from 'mqtt';
import { Red, NodeStatus } from 'node-red';
import { CollectorNode, CollectorConfig, MQTTNode } from './types';

enum CollectorStateType {
    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED',
    RECONNECT = 'RECONNECT'
};

const status = {
    [CollectorStateType.CONNECTED]: {
        fill: 'green',
        shape: 'dot',
        text: 'node-red:common.status.connected'
    } as NodeStatus,
    [CollectorStateType.DISCONNECTED]: {
        fill: 'red',
        shape: 'ring',
        text: 'node-red:common.status.disconnected'
    } as NodeStatus,
    [CollectorStateType.RECONNECT]: {
        fill: 'yellow',
        shape: 'dot',
        text: 'node-red:common.status.connecting'
    } as NodeStatus
};

export = (RED: Red): void =>
    RED.nodes.registerType('glartek-collector', function (this: CollectorNode, config: CollectorConfig) {
        const node: CollectorNode = this;

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
            username: '',
            password: '',
            rejectUnauthorized: false,
            ca: '',
            key: '',
            cert: ''
        };

        if (config.username && config.password) {
            options.username = config.username;
            options.password = config.password;
        }

        if (config.tls) {
            options.rejectUnauthorized = true;
            options.ca = config.tlsca;
            options.key = config.tlspriv;
            options.cert = config.tlscert;
            //options.protocol = 'mqtts';
        }

        this.users = [];

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
                        node.log(`collectorclient.mqtt.state.connected (${node.clientid}@${node.brokerurl})`);
                        for (var id in node.users) {
                            if (node.users.hasOwnProperty(id)) {
                                node.users[id].status(status[CollectorStateType.CONNECTED]);
                            }
                        }
                    });

                    // On mqtt reconnect
                    node.client.on('reconnect', function() {
                        node.connected = false;
                        node.connecting = true;

                        for (var id in node.users) {
                            if (node.users.hasOwnProperty(id)) {
                                node.users[id].status(status[CollectorStateType.RECONNECT]);
                            }
                        }
                    });

                    node.client.on('close', function() {
                         // Is connection up?
                         if (node.connected) {
                            node.connected = false;
                            node.log(`collectorclient.mqtt.state.disconnected (${node.clientid}@${node.brokerurl})`);
                            for (var id in node.users) {
                                if (node.users.hasOwnProperty(id)) {
                                    node.users[id].status(status[CollectorStateType.DISCONNECTED]);
                                }
                            }
                        }
                        
                        // Is connecting?   
                        if (node.connecting) {
                            node.log(`collectorclient.mqtt.state.connect-failed (${node.clientid}@${node.brokerurl})`);
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
                        client.end()
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
        this.register = function(mqttNode: MQTTNode) {
            node.users[mqttNode.id] = mqttNode;
            if (Object.keys(node.users).length === 1) {
                node.connect();
            }
        };

        // DeRegister node
        this.deregister = function(mqttNode: MQTTNode, done: mqtt.CloseCallback) {
            delete node.users[mqttNode.id];
            if (node.closing) {
                return done();
            }
            if (Object.keys(node.users).length === 0) {
                if (node.client && node.client.connected) {
                    return node.client.end(true);
                } else {
                    node.client.end();
                    return done();
                }
            }

            done();
        };

        node.register(this);
    });
