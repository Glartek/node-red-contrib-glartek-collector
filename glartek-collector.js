module.exports = function(RED) {
    'use strict';

    const path = require('path');
    const fs = require('fs');
    const mqtt = require('mqtt'),
        NeDBStore = require('mqtt-nedb-store');

    function GlartekCollectorNode(config) {
        const node = this;

        RED.nodes.createNode(node, config);

        node.warn('config.broker: ' + config.broker);
        node.warn('config.id: ' + config.id);
        node.warn('config.topic: ' + config.topic);

        const dir = path.join(RED.settings.userDir, 'glartek-collector');

        try {
            fs.mkdirSync(dir);
        }
        catch (e) {
        }

        const manager = NeDBStore(path.join(dir, 'mqtt'));

        manager.incoming.db.persistence.setAutocompactionInterval(60 * 1000);
        manager.outgoing.db.persistence.setAutocompactionInterval(60 * 1000);

        const options = {
            keepalive: 10,
            clientId: config.id,
            clean: false,
            connectTimeout: 5 * 1000,
            incomingStore: manager.incoming,
            outgoingStore: manager.outgoing,
            queueQoSZero: false,
        };

        if (config.username) {
            options.username = config.username;
            options.password = config.password;
        }

        const client = mqtt.connect(config.broker, options);

        client.on('reconnect', function() {
            node.warn('reconnect');
        });

        client.on('error', function(error) {
            node.error(error);
        });

        node.on('input', function(msg) {
            if (msg.payload && typeof msg.payload === 'object') {
                client.publish(config.topic, JSON.stringify(msg.payload), { qos: 1 });
            }
        });

        GlartekCollectorNode.prototype.close = function() {
            client.end(true);
        }
    }

    RED.nodes.registerType("glartek-collector", GlartekCollectorNode);
}
