import { MqttClient } from 'mqtt';
import { Node, NodeDef, NodeMessageInFlow } from 'node-red';

export type CollectorNode = { 
    connecting: boolean
    connected: boolean
    closing: boolean
    clientid: string
    brokerurl: string
    client: MqttClient
    users: Node[]
    connect: Function
    deregister: Function
    register: Function
} & Node;

export type CollectorConfig = {
    clientid: string;
    broker: string;
    topic: string;
    username: string;
    password: string;
    tls: boolean;
} & NodeDef;

export type MQTTNode = {
    id: number
} & Node;