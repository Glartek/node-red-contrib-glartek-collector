"use strict";

import mqtt from "mqtt";
import { NodeAPI, NodeAPISettingsWithData } from "node-red";
import { CollectorNode, CollectorConfig } from "./lib/types";
import { CollectorState, CollectorStateType } from "./lib/data";

export = (RED: NodeAPI<NodeAPISettingsWithData>): void =>
  RED.nodes.registerType(
    "glartek-collector",
    function (this: CollectorNode, config: CollectorConfig) {
      const node: CollectorNode = this;

      RED.nodes.createNode(node, config);

      // Clear node status
      node.status({});

      // Log current configurations
      console.log("glartek-collector: config.broker (" + config.broker + ")");
      console.log(
        "glartek-collector: config.clientid (" + config.clientid + ")"
      );
      console.log("glartek-collector: config.topic (" + config.topic + ")");

      const options: mqtt.IClientOptions = {
        keepalive: 10,
        clientId: config.clientid,
        port: config.port,
        clean: true,
        connectTimeout: 5 * 1000,
        queueQoSZero: false,
        username: "",
        password: "",
        rejectUnauthorized: false,
        ca: "",
        key: "",
        cert: "",
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

        const tlsAlpn = config.tlsalpn || "mqtt";
        options.ALPNProtocols = tlsAlpn.split(",");
      }

      this.users = [];

      this.connect = function () {
        if (!node.connected && !node.connecting) {
          node.connecting = true;

          try {
            const client = mqtt.connect(config.broker, options);
            node.client = client;

            // On mqtt connect
            node.client.on("connect", function () {
              const {
                client: { options: mqttClientOptions },
              } = node;

              node.connecting = false;
              node.connected = true;
              node.log(
                `collectorclient.mqtt.state.connected (${mqttClientOptions.clientId}@${mqttClientOptions.host}:${mqttClientOptions.port})`
              );
              for (var id in node.users) {
                if (node.users.hasOwnProperty(id)) {
                  node.users[id].status(
                    CollectorState[CollectorStateType.CONNECTED]
                  );
                }
              }
            });

            // On mqtt reconnect
            node.client.on("reconnect", function () {
              node.connected = false;
              node.connecting = true;

              for (var id in node.users) {
                if (node.users.hasOwnProperty(id)) {
                  node.users[id].status(
                    CollectorState[CollectorStateType.RECONNECT]
                  );
                }
              }
            });

            node.client.on("close", function () {
              const {
                client: { options: mqttClientOptions },
              } = node;

              // Is connection up?
              if (node.connected) {
                node.connected = false;
                node.log(
                  `collectorclient.mqtt.state.disconnected (${mqttClientOptions.clientId}@${mqttClientOptions.host}:${mqttClientOptions.port})`
                );
                for (var id in node.users) {
                  if (node.users.hasOwnProperty(id)) {
                    node.users[id].status(
                      CollectorState[CollectorStateType.DISCONNECTED]
                    );
                  }
                }
              }

              // Is connecting?
              if (node.connecting) {
                node.log(
                  `collectorclient.mqtt.state.connect-failed (${mqttClientOptions.clientId}@${mqttClientOptions.host}:${mqttClientOptions.port})`
                );
              }
            });

            // On mqtt close
            node.on("close", function (done: mqtt.CloseCallback) {
              // Deregister
              node.deregister(node, done);
            });

            // On mqtt error
            node.client.on("error", function (error) {
              node.error(error);
            });

            // On mqtt disconnect
            node.client.on("disconnect", function () {
              client.end();
            });

            node.on("input", function (msg) {
              if (!client.connected) {
                return;
              }

              if (msg.payload && typeof msg.payload === "object") {
                client.publish(config.topic, JSON.stringify([msg.payload]), {
                  qos: 1,
                });
              }
            });
          } catch (err) {
            console.log(err);
          }
        }
      };

      // Register node
      this.register = function (node: CollectorNode) {
        node.users[node.id] = node;
        if (Object.keys(node.users).length === 1) {
          node.connect();
        }
      };

      // DeRegister node
      this.deregister = function (
        node: CollectorNode,
        done: mqtt.CloseCallback
      ) {
        delete node.users[node.id];
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
    }
  );
