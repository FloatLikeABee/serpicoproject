declare module 'mqtt/dist/mqtt.min.js' {
  import type { IClientOptions, MqttClient } from 'mqtt';
  export function connect(brokerUrl: string, opts?: IClientOptions): MqttClient;
}
