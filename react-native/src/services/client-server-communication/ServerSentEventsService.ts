/**
 * @file ServerSentEventsService.ts
 * A service for handling Server-Sent Events (SSE) in React Native using react-native-sse.
 * Leverages the EventSource polyfill for real-time unidirectional server updates.
 *
 * --- DETAILED INTERVIEW QUESTIONS ---
 *
 * **Core SSE Concepts:**
 * - What are Server-Sent Events and how do they work? (One-way communication channel from server to client)
 * - How do SSEs differ from WebSockets? When would you choose SSE over WebSockets?
 * - What are the advantages and limitations of SSE? (Advantages: simple, auto-reconnect, standard HTTP. Limitations: one-way, connection limits)
 * - Explain the EventSource API and its key features (auto-reconnect, last-event-id).
 * - What is the MIME type for SSE events? (text/event-stream)
 * - What is the format of an SSE message? Describe the different fields (data, event, id, retry).
 * - How does SSE reconnection work? How is the last-event-id header used?
 *
 * **SSE Implementation:**
 * - How do you handle server-sent events in browsers vs. React Native? (React Native requires polyfill or custom implementation)
 * - How does error handling work with SSE? What happens when the connection is lost?
 * - How would you implement custom event types with SSE?
 * - What strategies can be used to maintain long-running SSE connections in a mobile app?
 * - How would you handle authentication with SSE? (Initial handshake, cookies, query params, headers)
 * - What are common challenges when using SSE in production systems?
 * - How would you test SSE functionality?
 *
 * **React Native Specific:**
 * - What are the considerations for SSE in React Native compared to web browsers?
 * - How do you handle SSE connections when an app goes to background or is minimized?
 * - How would you integrate SSE with React component lifecycles?
 * - What libraries or polyfills can be used for SSE in React Native? (e.g., react-native-sse, custom fetch-based)
 * - How would you manage multiple SSE connections in a complex app?
 *
 * **Using `react-native-sse` Library:**
 * - Why might you choose to use a library like `react-native-sse` instead of implementing SSE from scratch in React Native? (Standard API, potentially better handling of edge cases, community support)
 * - What potential configuration options does `react-native-sse` offer? (e.g., headers, timeout, polyfill behavior)
 * - How does `react-native-sse` handle reconnections and the `Last-Event-ID` header internally?
 * - Are there any known limitations or platform-specific behaviors when using `react-native-sse`?
 * - How would you debug issues specifically related to the `react-native-sse` library?
 *
 * **Advanced SSE:**
 * - How would you implement connection backoff for reconnecting SSE? (Often handled by the library, but good to understand the concept)
 * - How would you optimize battery usage when using SSE on mobile devices?
 * - How would you implement load balancing for SSE connections?
 * - What are the security implications of using SSE? How do you prevent unauthorized access?
 * - How would you handle versioning of event types and formats?
 * - Compare SSE, WebSockets, and HTTP Long Polling for different use cases.
 * - How do you monitor and debug SSE connections on mobile devices?
 */

// Import EventSource from the library instead of using the custom RNEventSource
import EventSource from 'react-native-sse';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Keep for potential future use (though library might handle lastEventId)
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Note: The custom RNEventSource class and ConnectionState enum below would be removed
// if fully switching to react-native-sse, as the library provides its own EventSource.
// For demonstration, we'll modify the service class to use the imported EventSource.

// Connection state enum - May still be useful for the service layer's tracking
enum ConnectionState {
  CONNECTING = 0, // EventSource.CONNECTING
  OPEN = 1,       // EventSource.OPEN
  CLOSED = 2,       // EventSource.CLOSED
  // RECONNECTING state might need custom tracking if not directly exposed by the library
}

// --- Custom RNEventSource class would be removed ---
// class RNEventSource { ... } // Remove this entire class definition

/**
 * Service for managing Server-Sent Events connections using react-native-sse
 */
class ServerSentEventsService {
  private static instance: ServerSentEventsService;
  // Use the imported EventSource type
  private eventSources: Map<string, EventSource> = new Map();
  // Keep track of listeners added via the service for potential re-attachment if needed
  private eventListeners: Map<string, { type: string; listener: (event: any) => void }[]> = new Map();
  // Store connection parameters for manual reconnection logic if required
  private connectionParams: Map<string, { url: string; options: EventSourceInit }> = new Map();
  private appStateListener: any;
  private netInfoSubscription: any;

  private constructor() {
    this.setupAppStateListener();
    this.setupNetworkListener();
  }

  /**
   * Get the singleton instance of ServerSentEventsService
   */
  public static getInstance(): ServerSentEventsService {
    if (!ServerSentEventsService.instance) {
      ServerSentEventsService.instance = new ServerSentEventsService();
    }
    return ServerSentEventsService.instance;
  }

  /**
   * Set up a listener to manage connections when app state changes
   */
  private setupAppStateListener(): void {
    this.appStateListener = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log(`SSE Service: App state changed to ${nextAppState}`);
      if (nextAppState === 'active') {
        // App has come to the foreground. react-native-sse might handle reconnection automatically.
        // However, if we explicitly closed connections on backgrounding, we might need to reconnect them.
        this.reconnectAllIfNeeded();
      } else if (nextAppState.match(/inactive|background/)) {
        // App has gone to the background or become inactive.
        // Consider closing connections explicitly to save resources, especially on Android.
        // Note: react-native-sse might have its own background handling. Check its documentation.
        console.log('SSE Service: App backgrounded, potentially pausing connections.');
        // Example: Explicitly close connections if desired for battery saving
        // this.pauseAll(); // Uncomment if explicit pausing is needed
      }
    });
  }

  /**
   * Set up network connectivity listener
   */
  private setupNetworkListener(): void {
    this.netInfoSubscription = NetInfo.addEventListener(state => {
      console.log(`SSE Service: Network state changed. Connected: ${state.isConnected}, Reachable: ${state.isInternetReachable}`);
      if (state.isConnected && state.isInternetReachable) {
        // Network is back. react-native-sse should attempt reconnection automatically.
        // We might add logic here if manual intervention is needed based on library behavior.
        console.log('SSE Service: Network available, ensuring connections are active.');
        this.reconnectAllIfNeeded(); // Check and reconnect if needed
      } else {
        // Network lost. react-native-sse should detect this and trigger error/close events.
        console.log('SSE Service: Network lost.');
        // No explicit close needed here usually, as the library handles connection drops.
      }
    });
  }

  /**
   * Reconnect connections that are currently closed, potentially after app resume or network recovery.
   */
  private reconnectAllIfNeeded(): void {
    console.log('SSE Service: Checking connections for reconnection...');
    for (const [id, eventSource] of this.eventSources.entries()) {
      // Check if the source exists and is in a closed state
      // Note: readyState values are typically 0 (CONNECTING), 1 (OPEN), 2 (CLOSED)
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        const params = this.connectionParams.get(id);
        if (params) {
          console.log(`SSE Service: Re-establishing connection for id: ${id}`);
          // Re-create the EventSource instance.
          // Important: Ensure listeners are re-attached.
          this.connect(id, params.url, params.options);
        } else {
           console.warn(`SSE Service: Cannot reconnect ${id}, missing connection parameters.`);
        }
      } else if (eventSource) {
         console.log(`SSE Service: Connection ${id} state: ${this.getConnectionStateString(eventSource.readyState)}`);
      }
    }
  }

  /**
   * Pause all connections (close them explicitly)
   */
  private pauseAll(): void {
    console.log('SSE Service: Pausing all connections...');
    for (const [id, eventSource] of this.eventSources.entries()) {
      if (eventSource.readyState === EventSource.OPEN || eventSource.readyState === EventSource.CONNECTING) {
        console.log(`SSE Service: Closing connection ${id} for pause.`);
        eventSource.close(); // Use the library's close method
      }
    }
    // Note: We keep connectionParams and eventListeners so we can reconnect later.
  }

  /**
   * Connect to a server-sent events endpoint using react-native-sse
   * @param id Unique identifier for this connection
   * @param url The SSE endpoint URL
   * @param options Options for EventSource (e.g., headers). See react-native-sse docs.
   * @returns The EventSource instance from react-native-sse
   */
  public connect(id: string, url: string, options: EventSourceInit = {}): EventSource {
    // Close existing connection if any to ensure clean state
    this.close(id);

    console.log(`SSE Service: Connecting to ${url} with id ${id}`);
    // Store connection parameters for potential manual reconnection
    this.connectionParams.set(id, { url, options });

    // Create new EventSource using the imported library
    // Pass headers or other configurations via the options object
    const eventSource = new EventSource(url, options);
    this.eventSources.set(id, eventSource);

    // Initialize or clear listeners storage for this ID
    this.eventListeners.set(id, []);

    // Attach standard listeners for logging/status updates
    eventSource.addEventListener('open', (event) => {
      console.log(`SSE Service [${id}]: Connection opened.`);
      // Optionally update internal state or emit an event
    });

    eventSource.addEventListener('error', (event: any) => {
      // The library might provide more detailed error objects
      console.error(`SSE Service [${id}]: Error occurred.`, event);
      // The library typically handles reconnection automatically after errors.
      // Check library docs for specifics on error event content and behavior.
    });

    // Re-attach any listeners that were previously added via addListener
    // This is crucial if connect is called again for reconnection.
    const existingListeners = this.eventListeners.get(id) || [];
    existingListeners.forEach(({ type, listener }) => {
       console.log(`SSE Service [${id}]: Re-attaching listener for type '${type}'`);
       eventSource.addEventListener(type, listener);
    });


    console.log(`SSE Service: Connection attempt initiated for ${id}`);
    return eventSource;
  }

  /**
   * Add an event listener to a specific SSE connection
   * @param id The connection identifier
   * @param type Event type to listen for ('message', 'open', 'error', or custom)
   * @param listener Function to call when event occurs
   */
  public addListener(id: string, type: string, listener: (event: any) => void): void {
    const eventSource = this.eventSources.get(id);
    if (!eventSource) {
      console.error(`SSE Service: Cannot add listener. No connection found with id ${id}`);
      return;
    }

    console.log(`SSE Service [${id}]: Adding listener for type '${type}'`);
    eventSource.addEventListener(type, listener);

    // Store listener reference in case we need to re-attach it upon manual reconnection
    const listeners = this.eventListeners.get(id) || [];
    // Avoid adding duplicates if listener already exists
    if (!listeners.some(l => l.type === type && l.listener === listener)) {
        listeners.push({ type, listener });
        this.eventListeners.set(id, listeners);
    }
  }

  /**
   * Remove an event listener from a specific SSE connection
   * @param id The connection identifier
   * @param type Event type to remove listener from
   * @param listener Function to remove
   */
  public removeListener(id: string, type: string, listener: (event: any) => void): void {
    const eventSource = this.eventSources.get(id);
    if (!eventSource) {
        console.warn(`SSE Service: Cannot remove listener. No connection found with id ${id}`);
        return;
    }

    console.log(`SSE Service [${id}]: Removing listener for type '${type}'`);
    eventSource.removeEventListener(type, listener);

    // Update stored listeners
    const listeners = this.eventListeners.get(id) || [];
    const updatedListeners = listeners.filter(
      l => !(l.type === type && l.listener === listener)
    );
    this.eventListeners.set(id, updatedListeners);
  }

  /**
   * Close a specific SSE connection
   * @param id The connection identifier
   */
  public close(id: string): void {
    const eventSource = this.eventSources.get(id);
    if (eventSource) {
      console.log(`SSE Service: Closing connection ${id}`);
      eventSource.close(); // Use the library's close method
      this.eventSources.delete(id);
      // Optionally clear listeners and params if this is a permanent close
      // this.eventListeners.delete(id);
      // this.connectionParams.delete(id);
    }
  }

  /**
   * Close all SSE connections managed by the service
   */
  public closeAll(): void {
    console.log('SSE Service: Closing all connections...');
    for (const id of this.eventSources.keys()) {
      this.close(id);
    }
    // Clear all tracking maps
    this.eventSources.clear();
    this.eventListeners.clear();
    this.connectionParams.clear();
    console.log('SSE Service: All connections closed and maps cleared.');
  }

  // Note: The explicit reconnect method might be less necessary if the library handles it well,
  // but could be kept for manual triggering if needed.
  /**
   * Manually trigger a reconnection for a specific ID.
   * This closes the current connection and opens a new one using stored parameters.
   * @param id The connection identifier
   */
  public reconnect(id: string): void {
    const params = this.connectionParams.get(id);
    if (!params) {
      console.error(`SSE Service: Cannot reconnect ${id}, missing connection parameters.`);
      return;
    }
    console.log(`SSE Service: Manually triggering reconnect for ${id}`);
    // Close existing and establish new connection, which will re-attach listeners
    this.connect(id, params.url, params.options);
  }


  /**
   * Clean up resources (listeners, connections)
   */
  public cleanup(): void {
    console.log('SSE Service: Cleaning up...');
    this.closeAll();

    // Remove app state listener
    if (this.appStateListener && typeof this.appStateListener.remove === 'function') {
      console.log('SSE Service: Removing AppState listener.');
      this.appStateListener.remove();
      this.appStateListener = null;
    }

    // Remove network listener
    if (this.netInfoSubscription && typeof this.netInfoSubscription === 'function') {
      console.log('SSE Service: Removing NetInfo listener.');
      this.netInfoSubscription(); // Unsubscribe function provided by NetInfo.addEventListener
      this.netInfoSubscription = null;
    }
    console.log('SSE Service: Cleanup complete.');
  }

  /**
   * Get the connection state of a specific SSE connection
   * @param id The connection identifier
   * @returns 'connecting', 'open', 'closed', or null if not found
   */
  public getConnectionState(id: string): string | null {
    const eventSource = this.eventSources.get(id);
    if (!eventSource) return null;

    return this.getConnectionStateString(eventSource.readyState);
  }

  private getConnectionStateString(readyState: number): string {
     switch (readyState) {
      case EventSource.CONNECTING: return 'connecting';
      case EventSource.OPEN: return 'open';
      case EventSource.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }

  // Note: Configuration methods like setMaxReconnectTime might not be directly
  // available if using react-native-sse. Configuration is usually done at instantiation.
  // Remove or adapt these based on the library's capabilities.
  /*
  public configureConnection(id: string, options: { ... }): void {
    // Configuration might need to happen by closing and reconnecting
    // with new options, depending on the library.
    console.warn("SSE Service: configureConnection might require reconnecting with new options for react-native-sse.");
  }
  */
}

// Export the service and potentially the EventSource type if needed elsewhere
export { ServerSentEventsService, EventSource }; // Exporting EventSource from the library
export default ServerSentEventsService;

// --- Example Usage (Remains largely the same, but uses the service backed by react-native-sse) ---
/*
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Button } from 'react-native';
import ServerSentEventsService from './ServerSentEventsService'; // Adjust path if needed

const SSEDemo = () => {
  const [events, setEvents] = useState<Array<{ id: number, message: string, type: string }>>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Initializing...');
  const sourceId = 'notifications'; // Unique ID for this connection

  useEffect(() => {
    const sseService = ServerSentEventsService.getInstance();
    const sseUrl = 'YOUR_SSE_ENDPOINT_URL'; // Replace with your actual SSE URL
    const token = 'YOUR_AUTH_TOKEN'; // Replace with your actual token logic

    console.log('SSEDemo: useEffect setup');

    // --- Connection Setup ---
    sseService.connect(sourceId, sseUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream', // Good practice, though library might add it
      },
      // Add other react-native-sse specific options if needed
      // e.g., timeoutInterval: 30000, // Example: 30 second timeout
    });

    // --- Status Listener ---
    // Helper to update status based on EventSource state
    const updateStatus = () => {
      const state = sseService.getConnectionState(sourceId);
      setConnectionStatus(state ?? 'Not Found');
    };

    // --- Event Listeners ---
    const handleOpen = (event: any) => {
      console.log('SSEDemo: SSE connection opened', event);
      updateStatus();
    };

    const handleMessage = (event: any) => {
      console.log('SSEDemo: Received message event:', event);
      try {
        // Assuming data is JSON, adjust if it's plain text
        const data = JSON.parse(event.data);
        setEvents(prev => [...prev, { id: event.lastEventId || Date.now(), message: data.message || event.data, type: 'message' }]);
      } catch (error) {
        console.error('SSEDemo: Error parsing message data:', error);
        // Handle plain text data
        setEvents(prev => [...prev, { id: event.lastEventId || Date.now(), message: event.data, type: 'message' }]);
      }
      updateStatus(); // Status is 'open' here
    };

    const handleCustomEvent = (event: any) => {
      console.log(`SSEDemo: Received custom event (${event.type}):`, event);
      setEvents(prev => [...prev, { id: event.lastEventId || Date.now(), message: `Custom Event: ${event.data}`, type: event.type }]);
      updateStatus();
    };

    const handleError = (event: any) => {
      console.error('SSEDemo: SSE error occurred:', event);
      // Note: react-native-sse might automatically try to reconnect.
      // The state might briefly be 'closed' or stay 'connecting' during retries.
      updateStatus(); // Update status to reflect error/closed state
    };

    // Add listeners using the service
    sseService.addListener(sourceId, 'open', handleOpen);
    sseService.addListener(sourceId, 'message', handleMessage);
    sseService.addListener(sourceId, 'custom_update', handleCustomEvent); // Example custom event
    sseService.addListener(sourceId, 'error', handleError);

    // Initial status check
    updateStatus();

    // --- Cleanup ---
    return () => {
      console.log('SSEDemo: useEffect cleanup');
      // It's important to remove the specific listener function instances
      sseService.removeListener(sourceId, 'open', handleOpen);
      sseService.removeListener(sourceId, 'message', handleMessage);
      sseService.removeListener(sourceId, 'custom_update', handleCustomEvent);
      sseService.removeListener(sourceId, 'error', handleError);
      // Close the connection when the component unmounts
      sseService.close(sourceId);
      console.log('SSEDemo: Connection closed and listeners removed.');
    };
  }, []); // Empty dependency array ensures this runs only once on mount/unmount

  const handleReconnect = () => {
    console.log('SSEDemo: Manual reconnect requested');
    ServerSentEventsService.getInstance().reconnect(sourceId);
  };

  return (
    <View style={{ padding: 10, flex: 1 }}>
      <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>SSE Status: {connectionStatus}</Text>
      <Button title="Manual Reconnect" onPress={handleReconnect} />
      <Text style={{ marginTop: 10, marginBottom: 5, fontWeight: 'bold' }}>Received Events:</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Text style={{ borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 4 }}>
            [{item.type}] {item.message} (ID: {item.id})
          </Text>
        )}
        style={{ flex: 1 }}
      />
    </View>
  );
};

export default SSEDemo;
*/