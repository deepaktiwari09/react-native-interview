/**
 * @file MQTTService.ts
 * A service for MQTT (Message Queuing Telemetry Transport) communication in React Native.
 * Uses the MQTT.js library for MQTT protocol implementation.
 * 
 * --- DETAILED INTERVIEW QUESTIONS ---
 *
 * **Core MQTT Concepts:**
 * - What is MQTT and what problem does it solve? (Lightweight publish/subscribe protocol for IoT/low bandwidth/battery devices)
 * - Explain the publish/subscribe pattern in MQTT. How does it differ from request/response?
 * - What are MQTT topics? Explain topic structure, wildcards (+, #), and best practices for topic design.
 * - Describe the different QoS (Quality of Service) levels in MQTT (0, 1, 2) and when to use each.
 * - What is the role of an MQTT broker? Name some popular MQTT broker implementations (Mosquitto, HiveMQ, AWS IoT Core, etc.)
 * - Explain MQTT retained messages and when they are useful.
 * - What is the purpose of the "Last Will and Testament" (LWT) feature in MQTT?
 * - How does MQTT handle connection persistence and offline scenarios?
 * 
 * **MQTT Implementation in React Native:**
 * - Compare different MQTT client libraries for React Native. What are their pros and cons?
 * - How would you handle connection state management in an MQTT client?
 * - What strategies would you use for error handling and reconnection in MQTT?
 * - How would you structure topic subscriptions in a large application?
 * - How do you handle security in MQTT connections? (TLS, username/password, certificates)
 * - How can you optimize battery usage when implementing MQTT in a mobile app?
 * - Explain how you would implement MQTT over WebSockets and why this might be necessary for web/mobile clients.
 * 
 * **Advanced MQTT:**
 * - What are MQTT 5 features and how do they improve over MQTT 3.1.1?
 * - How would you implement message filtering on the client vs. server side?
 * - Explain MQTT's role in an IoT architecture. How does it compare to protocols like CoAP, AMQP, or HTTP?
 * - How would you debug MQTT communication issues?
 * - Describe strategies for handling large message volumes and high frequency publishing.
 * - What are the security considerations when using MQTT in production applications?
 * - How would you implement end-to-end encryption for MQTT messages beyond transport-level TLS?
 * - How would you handle binary data transmission over MQTT?
 * 
 * **React Native Specific Questions:**
 * - How do you ensure MQTT connections work properly when your app is in background?
 * - How would you integrate MQTT with React's component lifecycle and state management?
 * - What strategies would you use to test MQTT functionality in a React Native app?
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import MQTT from 'mqtt/dist/mqtt'; // Using browser version of MQTT.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';

// MQTT Connection options interface
interface MQTTConnectionOptions {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  port?: number;
  keepalive?: number;
  clean?: boolean;
  connectTimeout?: number;
  reconnectPeriod?: number;
  will?: {
    topic: string;
    payload: string;
    qos: 0 | 1 | 2;
    retain: boolean;
  };
}

// MQTT Message interface
interface MQTTMessage {
  topic: string;
  payload: Buffer | string;
  qos: 0 | 1 | 2;
  retain?: boolean;
}

// Events emitted by the MQTTService
enum MQTTEvents {
  CONNECT = 'connect',
  RECONNECT = 'reconnect',
  CLOSE = 'close',
  DISCONNECT = 'disconnect',
  OFFLINE = 'offline',
  ERROR = 'error',
  END = 'end',
  MESSAGE = 'message',
  PACKETSEND = 'packetsend',
  PACKETRECEIVE = 'packetreceive',
}

class MQTTService extends EventEmitter {
  private static instance: MQTTService;
  private client: MQTT.Client | null = null;
  private options: MQTTConnectionOptions | null = null;
  private subscriptions: Map<string, (topic: string, message: string) => void> = new Map();
  private connected: boolean = false;
  private connecting: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  
  // Default connection configuration
  private defaultOptions = {
    keepalive: 60,
    clean: true,
    connectTimeout: 30 * 1000, // 30 seconds
    reconnectPeriod: 1000, // 1 second
    queueQoSZero: false,
  };

  private constructor() {
    super();
    // Set max listener count to avoid memory leak warnings
    this.setMaxListeners(50);
  }

  /**
   * Get the singleton instance of MQTTService
   * Interview Question: Why is a singleton appropriate for an MQTT client?
   */
  public static getInstance(): MQTTService {
    if (!MQTTService.instance) {
      MQTTService.instance = new MQTTService();
    }
    return MQTTService.instance;
  }

  /**
   * Initialize and connect to the MQTT broker
   * @param options The connection options
   * @returns Promise resolving on connection or rejecting on error
   * Interview Question: What are important parameters to consider when establishing an MQTT connection?
   */
  public async connect(options: MQTTConnectionOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client && this.connected) {
        console.log('MQTT: Already connected');
        resolve();
        return;
      }
      
      if (this.connecting) {
        console.log('MQTT: Connection in progress');
        reject(new Error('Connection already in progress'));
        return;
      }
      
      this.connecting = true;
      this.options = { ...this.defaultOptions, ...options };
      
      // Generate client ID if not provided
      if (!this.options.clientId) {
        this.options.clientId = `rn-mqtt-${Math.random().toString(16).substring(2, 10)}`;
      }
      
      const connectOptions: MQTT.IClientOptions = {
        keepalive: this.options.keepalive,
        clientId: this.options.clientId,
        clean: this.options.clean,
        reconnectPeriod: this.options.reconnectPeriod,
        connectTimeout: this.options.connectTimeout,
      };
      
      // Add auth if provided
      if (this.options.username) {
        connectOptions.username = this.options.username;
        connectOptions.password = this.options.password;
      }
      
      // Add will message if provided
      if (this.options.will) {
        connectOptions.will = this.options.will;
      }
      
      console.log(`MQTT: Connecting to ${this.options.brokerUrl}`);
      
      try {
        // Create MQTT client
        this.client = MQTT.connect(this.options.brokerUrl, connectOptions);
        
        // Set up event listeners
        this.client.on(MQTTEvents.CONNECT, () => {
          console.log('MQTT: Connected successfully');
          this.connected = true;
          this.connecting = false;
          this.reconnectAttempts = 0;
          this.emit(MQTTEvents.CONNECT);
          
          // Resubscribe to previously subscribed topics
          this.resubscribe();
          
          resolve();
        });
        
        this.client.on(MQTTEvents.ERROR, (error) => {
          console.error('MQTT: Connection error', error);
          this.emit(MQTTEvents.ERROR, error);
          if (this.connecting) {
            this.connecting = false;
            reject(error);
          }
        });
        
        this.client.on(MQTTEvents.DISCONNECT, () => {
          console.log('MQTT: Disconnected');
          this.connected = false;
          this.emit(MQTTEvents.DISCONNECT);
        });
        
        this.client.on(MQTTEvents.RECONNECT, () => {
          this.reconnectAttempts++;
          console.log(`MQTT: Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          this.emit(MQTTEvents.RECONNECT, this.reconnectAttempts);
          
          // If max reconnect attempts reached, stop reconnecting
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('MQTT: Max reconnect attempts reached, giving up');
            this.client?.end();
          }
        });
        
        this.client.on(MQTTEvents.CLOSE, () => {
          console.log('MQTT: Connection closed');
          this.connected = false;
          this.emit(MQTTEvents.CLOSE);
        });
        
        this.client.on(MQTTEvents.OFFLINE, () => {
          console.log('MQTT: Client went offline');
          this.connected = false;
          this.emit(MQTTEvents.OFFLINE);
        });
        
        this.client.on(MQTTEvents.MESSAGE, (topic: string, message: Buffer, packet: MQTT.IPublishPacket) => {
          const messageStr = message.toString();
          // console.log(`MQTT: Message received on ${topic}:`, messageStr);
          
          // Emit the message event to any listeners
          this.emit(MQTTEvents.MESSAGE, topic, messageStr, packet);
          
          // Call any topic-specific handlers
          const handler = this.subscriptions.get(topic);
          if (handler) {
            handler(topic, messageStr);
          }
          
          // Handle wildcard subscriptions by iterating through all subscriptions
          // and calling handlers for matching topics
          this.subscriptions.forEach((wildcardHandler, wildcardTopic) => {
            if (
              wildcardTopic !== topic && // Skip exact matches as they were handled above
              this.topicMatchesWildcard(topic, wildcardTopic)
            ) {
              wildcardHandler(topic, messageStr);
            }
          });
        });
        
      } catch (err) {
        console.error('MQTT: Failed to connect', err);
        this.connecting = false;
        reject(err);
      }
    });
  }

  /**
   * Subscribe to an MQTT topic
   * @param topic The topic to subscribe to (can include wildcards)
   * @param options Optional subscription options
   * @param handler Optional message handler for this specific topic
   * Interview Question: How would you implement topic-specific message handling in MQTT?
   */
  public subscribe(
    topic: string,
    options: { qos: 0 | 1 | 2 } = { qos: 0 },
    handler?: (topic: string, message: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.connected) {
        console.error('MQTT: Cannot subscribe, not connected');
        reject(new Error('Not connected'));
        return;
      }
      
      console.log(`MQTT: Subscribing to ${topic} with QoS ${options.qos}`);
      
      this.client.subscribe(topic, options, (err, granted) => {
        if (err) {
          console.error(`MQTT: Failed to subscribe to ${topic}`, err);
          reject(err);
          return;
        }
        
        console.log(`MQTT: Successfully subscribed to ${topic}`);
        
        // Store handler if provided
        if (handler) {
          this.subscriptions.set(topic, handler);
        }
        
        // Save subscription to AsyncStorage for persistence
        this.saveSubscription(topic, options.qos);
        
        resolve();
      });
    });
  }

  /**
   * Unsubscribe from an MQTT topic
   * @param topic The topic to unsubscribe from
   * Interview Question: What happens if a client unsubscribes and then reconnects?
   */
  public unsubscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.connected) {
        console.error('MQTT: Cannot unsubscribe, not connected');
        reject(new Error('Not connected'));
        return;
      }
      
      console.log(`MQTT: Unsubscribing from ${topic}`);
      
      this.client.unsubscribe(topic, (err) => {
        if (err) {
          console.error(`MQTT: Failed to unsubscribe from ${topic}`, err);
          reject(err);
          return;
        }
        
        console.log(`MQTT: Successfully unsubscribed from ${topic}`);
        
        // Remove handler if exists
        this.subscriptions.delete(topic);
        
        // Remove subscription from AsyncStorage
        this.removeSubscription(topic);
        
        resolve();
      });
    });
  }

  /**
   * Publish a message to an MQTT topic
   * @param topic The topic to publish to
   * @param message The message to publish
   * @param options Optional publish options (QoS, retain)
   * Interview Question: When would you use retained messages in MQTT?
   */
  public publish(
    topic: string,
    message: string | Buffer,
    options: { qos: 0 | 1 | 2; retain?: boolean } = { qos: 0, retain: false }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.connected) {
        console.error('MQTT: Cannot publish, not connected');
        reject(new Error('Not connected'));
        return;
      }
      
      console.log(`MQTT: Publishing to ${topic}`);
      
      this.client.publish(topic, message, options, (err) => {
        if (err) {
          console.error(`MQTT: Failed to publish to ${topic}`, err);
          reject(err);
          return;
        }
        
        console.log(`MQTT: Successfully published to ${topic}`);
        resolve();
      });
    });
  }

  /**
   * Disconnect from the MQTT broker
   * Interview Question: What's the proper way to clean up MQTT connections?
   */
  public disconnect(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.client || !this.connected) {
        console.log('MQTT: Already disconnected');
        resolve();
        return;
      }
      
      console.log('MQTT: Disconnecting...');
      
      // Cancel any reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Set up a listener for the end event
      this.client.once(MQTTEvents.END, () => {
        console.log('MQTT: Disconnected successfully');
        this.connected = false;
        this.connecting = false;
        resolve();
      });
      
      // End the connection
      this.client.end(false); // false to not force close
    });
  }

  /**
   * Check if the client is currently connected to the broker
   * Interview Question: How would you keep track of connection state in a React Native app?
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Save a subscription to AsyncStorage for persistence
   * @param topic The topic that was subscribed to
   * @param qos The QoS level for the subscription
   */
  private async saveSubscription(topic: string, qos: 0 | 1 | 2): Promise<void> {
    try {
      const storedSubscriptionsStr = await AsyncStorage.getItem('mqttSubscriptions');
      const storedSubscriptions = storedSubscriptionsStr 
        ? JSON.parse(storedSubscriptionsStr) 
        : [];
      
      // Add subscription if not already saved
      const exists = storedSubscriptions.findIndex((sub: any) => sub.topic === topic) !== -1;
      if (!exists) {
        storedSubscriptions.push({ topic, qos });
        await AsyncStorage.setItem('mqttSubscriptions', JSON.stringify(storedSubscriptions));
      }
    } catch (error) {
      console.error('MQTT: Failed to save subscription', error);
    }
  }

  /**
   * Remove a subscription from AsyncStorage
   * @param topic The topic to remove
   */
  private async removeSubscription(topic: string): Promise<void> {
    try {
      const storedSubscriptionsStr = await AsyncStorage.getItem('mqttSubscriptions');
      if (storedSubscriptionsStr) {
        const storedSubscriptions = JSON.parse(storedSubscriptionsStr);
        
        const updatedSubscriptions = storedSubscriptions.filter(
          (sub: any) => sub.topic !== topic
        );
        
        await AsyncStorage.setItem('mqttSubscriptions', JSON.stringify(updatedSubscriptions));
      }
    } catch (error) {
      console.error('MQTT: Failed to remove subscription', error);
    }
  }

  /**
   * Resubscribe to all previously subscribed topics after reconnection
   * Interview Question: Why is it important to resubscribe after reconnection, especially with clean session=true?
   */
  private async resubscribe(): Promise<void> {
    if (!this.client || !this.connected) return;
    
    try {
      // Get stored subscriptions
      const storedSubscriptionsStr = await AsyncStorage.getItem('mqttSubscriptions');
      if (storedSubscriptionsStr) {
        const storedSubscriptions = JSON.parse(storedSubscriptionsStr);
        
        // Resubscribe to each topic
        for (const sub of storedSubscriptions) {
          console.log(`MQTT: Resubscribing to ${sub.topic} with QoS ${sub.qos}`);
          
          // Use Promise.resolve to avoid awaiting each subscription
          // This makes resubscription faster but less controlled
          Promise.resolve(
            this.client.subscribe(sub.topic, { qos: sub.qos }, (err) => {
              if (err) {
                console.error(`MQTT: Failed to resubscribe to ${sub.topic}`, err);
              } else {
                console.log(`MQTT: Successfully resubscribed to ${sub.topic}`);
              }
            })
          );
        }
      }
    } catch (error) {
      console.error('MQTT: Failed to resubscribe', error);
    }
  }

  /**
   * Check if a specific topic matches a wildcard subscription
   * @param actualTopic The actual topic of the message
   * @param wildcardTopic The wildcard subscription topic
   * @returns True if the actual topic matches the wildcard subscription
   * Interview Question: Explain how MQTT topic wildcards work and how you would implement matching logic
   */
  private topicMatchesWildcard(actualTopic: string, wildcardTopic: string): boolean {
    // If there are no wildcards, exact match is required
    if (!wildcardTopic.includes('+') && !wildcardTopic.includes('#')) {
      return actualTopic === wildcardTopic;
    }
    
    // Convert topics to arrays of segments
    const actual = actualTopic.split('/');
    const wildcard = wildcardTopic.split('/');
    
    // Special case: # wildcard at the end
    if (wildcard[wildcard.length - 1] === '#') {
      // Check all segments before the #
      for (let i = 0; i < wildcard.length - 1; i++) {
        if (wildcard[i] !== '+' && wildcard[i] !== actual[i]) {
          return false;
        }
      }
      return true;
    }
    
    // If segment counts don't match (and we don't have a # wildcard),
    // we can't have a match
    if (actual.length !== wildcard.length) {
      return false;
    }
    
    // Check each segment
    for (let i = 0; i < actual.length; i++) {
      // + matches any single level
      if (wildcard[i] === '+') {
        continue;
      }
      
      // Exact match required for non-wildcard segments
      if (wildcard[i] !== actual[i]) {
        return false;
      }
    }
    
    return true;
  }
}

export default MQTTService;

// --- Example Usage ---
/*
import MQTTService from './MQTTService';

const connectToMQTT = async () => {
  const mqttService = MQTTService.getInstance();
  
  try {
    await mqttService.connect({
      brokerUrl: 'mqtt://broker.example.com:1883',
      clientId: 'react-native-client',
      username: 'user',
      password: 'pass',
      // Last Will message that broker will publish if this client disconnects unexpectedly
      will: {
        topic: 'clients/status',
        payload: JSON.stringify({ clientId: 'react-native-client', status: 'offline' }),
        qos: 1,
        retain: true
      }
    });
    
    console.log('Connected to MQTT broker');
    
    // Subscribe to topics
    await mqttService.subscribe('sensors/temperature', { qos: 1 }, (topic, message) => {
      console.log(`Temperature reading: ${message}°C`);
    });
    
    await mqttService.subscribe('alerts/#', { qos: 2 }, (topic, message) => {
      console.log(`Alert received on ${topic}: ${message}`);
    });
    
    // Publish a message
    await mqttService.publish(
      'devices/status',
      JSON.stringify({ deviceId: 'phone1', status: 'online' }),
      { qos: 1, retain: true }
    );
    
  } catch (error) {
    console.error('MQTT connection failed:', error);
  }
};

// Listen for MQTT events
const setupMQTTListeners = () => {
  const mqttService = MQTTService.getInstance();
  
  mqttService.on('connect', () => {
    console.log('Connected to MQTT broker');
  });
  
  mqttService.on('message', (topic, message) => {
    console.log(`Message received on ${topic}: ${message}`);
  });
  
  mqttService.on('error', (error) => {
    console.error('MQTT error:', error);
  });
  
  mqttService.on('offline', () => {
    console.log('MQTT client is offline');
  });
};

// Usage in a component
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';

const MQTTComponent = () => {
  useEffect(() => {
    connectToMQTT();
    setupMQTTListeners();
    
    return () => {
      // Clean up MQTT connection when component unmounts
      MQTTService.getInstance().disconnect();
    };
  }, []);
  
  return (
    <View>
      <Text>MQTT Component</Text>
    </View>
  );
};
*/