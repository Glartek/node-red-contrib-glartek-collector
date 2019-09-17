module.exports = function(RED) {
    'use strict';

    const path = require('path');
    const fs = require('fs');
    const mqtt = require('mqtt'),
    NeDBStore = require('mqtt-nedb-store');

    function GlartekCollectorNode(config) {
        const node = this;

        RED.nodes.createNode(node, config);

        // Log current configurations
        console.log('glartek-collector: config.broker (' + config.broker + ')');
        console.log('glartek-collector: config.id  (' + config.id + ')');
        console.log('glartek-collector: config.topic (' + config.topic + ')');

        const options = {
            keepalive: 10,
            clientId: config.id,
            clean: false,
            connectTimeout: 5 * 1000,
            queueQoSZero: false,
        };

        if (config.username && config.password) {
            options.username = config.username;
            options.password = config.password;
        }

        // Prepare directory for MQTT Store
        const mqttStoreDir = path.join(RED.settings.userDir, 'glartek-collector/mqtt');

        try {
            if (!fs.existsSync(mqttStoreDir)) {
                console.log("glartek-collector: Trying to create directory on ", mqttStoreDir);

                // Create MQTT Store directory
                fs.mkdirSync(mqttStoreDir, { recursive: true });

                console.log("glartek-collector: Directory created on ", mqttStoreDir);
            }

            // Enable MQTT Store
            const manager = NeDBStore(mqttStoreDir);
            
            manager.incoming.db.persistence.setAutocompactionInterval(60 * 1000);
            manager.outgoing.db.persistence.setAutocompactionInterval(60 * 1000);

            options.incomingStore = manager.incoming;
            options.outgoingStore = manager.outgoing;
        }
        catch (e) {
            node.error(e);
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
                client.publish(config.topic, JSON.stringify([msg.payload]), { qos: 1 });
            }
        });

        GlartekCollectorNode.prototype.close = function() {
            client.end(true);
        }
    }

    RED.nodes.registerType("glartek-collector", GlartekCollectorNode);
}
