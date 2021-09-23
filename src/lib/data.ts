import { NodeStatus } from 'node-red';

export enum CollectorStateType {
    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED',
    RECONNECT = 'RECONNECT'
};

export const CollectorState = {
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