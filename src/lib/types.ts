import { MqttClient, CloseCallback } from "mqtt";
import { Node, NodeDef, NodeMessageInFlow } from "node-red";

export type CollectorNode = {
  id: number;
  connecting: boolean;
  connected: boolean;
  closing: boolean;
  clientid: string;
  brokerurl: string;
  client: MqttClient;
  users: Node[];
  connect: Function;
  deregister: (node: CollectorNode, done: CloseCallback) => void | MqttClient;
  register: (node: CollectorNode) => void;
} & Node;

export type CollectorConfig = {
  clientid: string;
  broker: string;
  port: number;
  topic: string;
  username: string;
  password: string;
  tls: boolean;
  tlsca: string;
  tlspriv: string;
  tlscert: string;
  tlsalpn: string;
} & NodeDef;

export type MQTTNode = {
  id: number;
} & Node;
