import { AppState, AppStateStatus } from 'react-native';
// Add socket.io-client import
import { io, Socket } from 'socket.io-client';
import { ManagerOptions, SocketOptions } from 'socket.io-client/build/esm/manager'; // Import specific types

export enum WebSocketStatus {
    CONNECTING = 'CONNECTING',
    OPEN = 'OPEN', // Equivalent to 'connected' in Socket.IO
    CLOSING = 'CLOSING', // Less direct mapping, use 'disconnecting' conceptually
    CLOSED = 'CLOSED', // Equivalent to 'disconnected' in Socket.IO
    RECONNECTING = 'RECONNECTING', // Socket.IO handles this internally, map relevant events
}

interface WebSocketServiceOptions {
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number; // Initial delay in ms
    reconnectionDelayMax?: number; // Max delay in ms
    autoConnect?: boolean; // Connect automatically on instantiation
    queueMessages?: boolean; // Queue messages sent while disconnected
    // Socket.IO specific options can be added here if needed
    path?: string; // e.g., '/socket.io'
    transports?: ('websocket' | 'polling')[]; // Default: ['polling', 'websocket']
    auth?: { [key: string]: any } | ((cb: (data: { [key: string]: any }) => void) => void); // For sending auth data
}

// Default options adjusted for Socket.IO where applicable
const DEFAULT_OPTIONS: Required<Omit<WebSocketServiceOptions, 'auth'>> & Pick<WebSocketServiceOptions, 'auth'> = {
    reconnection: true,
    reconnectionAttempts: 5, // maps to reconnectionAttempts
    reconnectionDelay: 1000, // maps to reconnectionDelay
    reconnectionDelayMax: 10000, // maps to reconnectionDelayMax
    autoConnect: false, // maps to autoConnect option in io()
    queueMessages: true,
    path: '/socket.io', // Default Socket.IO path
    transports: ['websocket', 'polling'], // Default transports
    auth: undefined, // Default no auth
};

// --- Add Socket.IO specific interview questions ---
/*
 * **Socket.IO Specific Questions:**
 * - What is Socket.IO and how does it differ from the standard WebSocket API? (Fallback mechanisms, rooms, namespaces, auto-reconnection, multiplexing)
 * - Explain the concept of transports in Socket.IO (WebSocket, Polling). Why is polling used as a fallback?
 * - What are Socket.IO Namespaces and Rooms? How are they used?
 * - How does Socket.IO handle automatic reconnection? How is it configured?
 * - Describe the event-based communication model in Socket.IO (`emit`, `on`). How does it differ from the `send`/`onmessage` of native WebSockets?
 * - How would you handle authentication with Socket.IO? (e.g., `auth` option, emitting an auth event)
 * - Discuss potential performance considerations when using Socket.IO compared to raw WebSockets.
 * - How does Socket.IO handle message acknowledgements?
 * - Explain how you would use middleware in Socket.IO (client or server-side).
*/


export class WebSocketService {
    // Change type to Socket.IO's Socket type
    private socket: Socket | null = null;
    private connectionUrl: string | null = null;
    // Ensure options type includes Socket.IO specific ones if needed
    private options: Required<Omit<WebSocketServiceOptions, 'auth'>> & Pick<WebSocketServiceOptions, 'auth'>;
    private status: WebSocketStatus = WebSocketStatus.CLOSED;
    // Reconnection attempts are handled by Socket.IO, remove custom tracking
    // private reconnectAttemptsLeft: number = 0;
    private reconnectTimer: NodeJS.Timeout | null = null; // Keep for potential manual triggers? Or remove? Let's remove for now.
    private explicitDisconnect: boolean = false; // Still useful to prevent auto-reconnect after manual disconnect
    private messageQueue: { event: string; data: any[] }[] = []; // Store event name and data
    // Auth token logic remains similar, but applied differently
    private authToken: string | (() => Promise<string>) | null = null;

    // --- Callbacks ---
    // onMessageCallback might be less relevant if using specific events
    private onMessageCallback: ((event: string, ...args: any[]) => void) | null = null; // Generic message handler
    // onJsonMessageCallback is replaced by specific event handlers or the generic onMessageCallback
    // private onJsonMessageCallback: ((message: any) => void) | null = null;
    private onOpenCallback: (() => void) | null = null; // Maps to 'connect'
    private onCloseCallback: ((reason: Socket.DisconnectReason, description?: any) => void) | null = null; // Maps to 'disconnect'
    private onErrorCallback: ((error: Error) => void) | null = null; // Maps to 'connect_error' and potentially other errors
    private onStatusChangeCallback: ((status: WebSocketStatus) => void) | null = null;

    constructor(url?: string, options: WebSocketServiceOptions = {}) {
        // Merge options carefully, mapping names if needed
        this.options = { ...DEFAULT_OPTIONS, ...options };
        // this.reconnectAttemptsLeft = this.options.reconnectionAttempts; // Remove

        if (url) {
            this.connectionUrl = url;
            if (this.options.autoConnect) {
                this.connect(url);
            }
        }

        AppState.addEventListener('change', this.handleAppStateChange);
    }

    // --- Callback Setters ---
    /**
     * Sets a generic callback for ALL incoming Socket.IO events.
     * Consider using specific event listeners (`on(eventName, callback)`) for better structure.
     */
    public setOnMessage(callback: (event: string, ...args: any[]) => void): void {
        this.onMessageCallback = callback;
        // If socket exists, attach a generic listener immediately? Or require reconnect?
        // This is tricky, usually specific listeners are better.
        if (this.socket) {
             console.warn("WebSocketService: setOnMessage called after connection. Consider setting specific listeners before connecting or reconnecting.");
             // Example of attaching a generic listener (might capture internal events too)
             // this.socket.onAny((event, ...args) => {
             //     if (this.onMessageCallback) this.onMessageCallback(event, ...args);
             // });
        }
    }

    /**
     * Register a callback for a specific Socket.IO event.
     * @param eventName The name of the event to listen for.
     * @param callback The function to call when the event is received.
     */
    public on(eventName: string, callback: (...args: any[]) => void): void {
        if (this.socket) {
            this.socket.on(eventName, callback);
        } else {
            console.warn(`WebSocketService: Socket not connected. Listener for '${eventName}' will be attached on next connection.`);
            // Store listeners to attach later? Or require setup before connect?
            // For simplicity, let's require setup before connect or rely on re-attaching in onOpen.
        }
    }

    /**
     * Unregister a callback for a specific Socket.IO event.
     * @param eventName The name of the event.
     * @param callback The specific callback function to remove. If omitted, removes all listeners for the event.
     */
    public off(eventName: string, callback?: (...args: any[]) => void): void {
        if (this.socket) {
            this.socket.off(eventName, callback);
        }
    }


    // setOnJsonMessage is removed, use on(eventName, callback) instead

    public setOnOpen(callback: () => void): void {
        this.onOpenCallback = callback;
    }
    public setOnClose(callback: (reason: Socket.DisconnectReason, description?: any) => void): void {
        this.onCloseCallback = callback;
    }
    public setOnError(callback: (error: Error) => void): void {
        this.onErrorCallback = callback;
    }
    public setOnStatusChange(callback: (status: WebSocketStatus) => void): void {
        this.onStatusChangeCallback = callback;
        callback(this.status);
    }

    public setAuthToken(token: string | (() => Promise<string>) | null): void {
        this.authToken = token;
        // If already connected, maybe send an auth update event? Depends on backend.
        // Or update the auth option for next connection attempt.
        if (this.socket && this.socket.auth) {
             console.warn("WebSocketService: Auth token set after connection. Updating auth for next connection attempt.");
             // Update auth dynamically if needed and supported by backend
             // this.socket.auth = await this.getAuthData(); // Example
        }
    }

    private async getAuthData(): Promise<Record<string, any> | undefined> {
         if (!this.authToken) return undefined;
         try {
            const token = typeof this.authToken === 'function' ? await this.authToken() : this.authToken;
            return token ? { token } : undefined; // Structure based on backend expectation
         } catch (error) {
            console.error("WebSocketService: Failed to get auth token for connection.", error);
            this.handleError(new Error("Failed to get auth token"));
            return undefined;
         }
    }


    private updateStatus(newStatus: WebSocketStatus): void {
        if (this.status !== newStatus) {
            this.status = newStatus;
            console.log(`WebSocketService: Status changed to ${this.status}`);
            if (this.onStatusChangeCallback) {
                try {
                    this.onStatusChangeCallback(this.status);
                } catch (error) {
                    console.error("WebSocketService: Error in onStatusChangeCallback", error);
                }
            }
        }
    }

    public getStatus(): WebSocketStatus {
        return this.status;
    }

    // Update connect method for Socket.IO
    public async connect(url?: string): Promise<void> { // Make async for auth
        if (url) {
            this.connectionUrl = url;
        }

        if (!this.connectionUrl) {
            console.error("WebSocketService: Connection URL is not set.");
            this.handleError(new Error("Connection URL not provided"));
            return;
        }

        // Check Socket.IO connection state
        if (this.socket && this.socket.connected) {
            console.warn(`WebSocketService: Already connected.`);
            return;
        }
        if (this.socket && this.socket.connecting) {
             console.warn(`WebSocketService: Connection attempt already in progress.`);
             return;
        }
        // If socket exists but disconnected, io() might reuse it or create new.
        // Let's disconnect explicitly first for cleaner state if trying to force a new connection.
        if (this.socket) {
             console.log("WebSocketService: Disconnecting existing socket before new connection attempt.");
             this.socket.disconnect();
             this.socket = null; // Ensure a new socket object is created by io()
        }


        // this.clearReconnectTimer(); // Remove - Socket.IO handles timers
        this.explicitDisconnect = false;
        this.updateStatus(WebSocketStatus.CONNECTING);
        console.log(`WebSocketService: Attempting to connect to ${this.connectionUrl} via Socket.IO...`);

        try {
            // Prepare Socket.IO options
            const ioOptions: Partial<ManagerOptions & SocketOptions> = {
                reconnection: this.options.reconnection,
                reconnectionAttempts: this.options.reconnectionAttempts,
                reconnectionDelay: this.options.reconnectionDelay,
                reconnectionDelayMax: this.options.reconnectionDelayMax,
                autoConnect: false, // We are calling connect explicitly
                transports: this.options.transports,
                path: this.options.path,
                // Add auth data
                auth: await this.getAuthData(),
                // Add other options if needed
            };

            // Create Socket.IO socket instance
            this.socket = io(this.connectionUrl, ioOptions);

            // Setup event handlers for the new socket instance
            this.setupEventHandlers();

            // Explicitly call connect if autoConnect is false (which it is in ioOptions)
            this.socket.connect();

        } catch (error) {
            console.error("WebSocketService: Failed to initialize Socket.IO connection.", error);
            this.handleError(error instanceof Error ? error : new Error('Socket.IO initialization failed'));
            this.updateStatus(WebSocketStatus.CLOSED); // Ensure status is CLOSED on init failure
        }
    }

    // Update event handlers for Socket.IO
    private setupEventHandlers(): void {
        if (!this.socket) return;

        // Remove previous listeners if any (important if reusing socket object, though we nullify it now)
        this.socket.removeAllListeners();

        // --- Connection Events ---
        this.socket.on('connect', () => {
            this.updateStatus(WebSocketStatus.OPEN);
            console.log(`WebSocketService: Socket.IO connected! ID: ${this.socket?.id}`);
            // Resetting attempts is handled internally by Socket.IO on successful connect

            // Auth is handled via `auth` option now, no need to send manually here unless required by specific backend logic.

            // Process message queue
            this.processMessageQueue();

            if (this.onOpenCallback) {
                try {
                    this.onOpenCallback();
                } catch (error) {
                    console.error("WebSocketService: Error in onOpenCallback", error);
                }
            }
            // Re-attach any dynamically added listeners if needed (if not required before connect)
            // Example: this.attachStoredListeners();
        });

        this.socket.on('disconnect', (reason: Socket.DisconnectReason, description?: any) => {
            console.log(`WebSocketService: Socket.IO disconnected. Reason: ${reason}`);
            this.updateStatus(WebSocketStatus.CLOSED);
            const wasExplicit = reason === 'io client disconnect'; // Check if due to explicit call

            // Socket.IO handles reconnection automatically based on options unless reason is 'io client disconnect'
            if (!wasExplicit && this.options.reconnection) {
                 console.log("WebSocketService: Socket.IO will attempt to reconnect automatically.");
                 // We can still reflect the RECONNECTING status based on internal events if needed
            } else {
                 console.log("WebSocketService: Auto-reconnection disabled or explicit disconnect.");
                 // Ensure explicit flag is set if disconnect was manual
                 if (wasExplicit) this.explicitDisconnect = true;
            }


            if (this.onCloseCallback) {
                try {
                    this.onCloseCallback(reason, description);
                } catch (error) {
                    console.error("WebSocketService: Error in onCloseCallback", error);
                }
            }

            // Don't nullify the socket here, Socket.IO might reuse it for reconnection
            // this.socket = null;
        });

        // --- Error Events ---
        this.socket.on('connect_error', (error: Error) => {
            console.error(`WebSocketService: Socket.IO connection error: ${error.message}`, error);
            // Socket.IO attempts reconnection automatically based on options
            this.updateStatus(WebSocketStatus.RECONNECTING); // Reflect reconnect attempt status
            this.handleError(error);
            // The 'disconnect' event might follow if reconnection fails ultimately
        });

        // Optional: Listen to other specific Socket.IO events
        this.socket.on('reconnect_attempt', (attempt: number) => {
            console.log(`WebSocketService: Socket.IO reconnect attempt ${attempt}...`);
            this.updateStatus(WebSocketStatus.RECONNECTING);
        });

        this.socket.on('reconnect_failed', () => {
            console.error('WebSocketService: Socket.IO reconnection failed after all attempts.');
            this.updateStatus(WebSocketStatus.CLOSED); // Failed to reconnect
            this.handleError(new Error("Reconnection failed"));
        });

         this.socket.on('reconnect_error', (error: Error) => {
            console.error(`WebSocketService: Socket.IO reconnect error: ${error.message}`);
             this.updateStatus(WebSocketStatus.RECONNECTING); // Still trying
             this.handleError(error);
        });

        this.socket.on('error', (error: Error) => {
             console.error(`WebSocketService: Socket.IO general error: ${error.message}`);
             // This is for errors that might not be connection related
             this.handleError(error);
        });


        // --- Message Handling ---
        // Remove generic onmessage handler - use specific events via on()
        // this.socket.onmessage = ...

        // Example: Listen for a standard 'message' event if your backend uses it
        this.socket.on('message', (...args: any[]) => {
             console.log("WebSocketService: Received 'message' event:", args);
             if (this.onMessageCallback) {
                 try {
                    this.onMessageCallback('message', ...args);
                 } catch (error) {
                    console.error("WebSocketService: Error in generic onMessageCallback for 'message' event", error);
                 }
             }
             // If specific JSON handler was intended for 'message':
             // if (this.onJsonMessageCallback) this.onJsonMessageCallback(args[0]);
        });

        // Add a generic listener if onMessageCallback is set (use with caution)
        if (this.onMessageCallback) {
             this.socket.onAny((event, ...args) => {
                 // Avoid logging internal/status events if too noisy
                 if (!['connect', 'disconnect', 'connect_error', 'reconnect_attempt', 'reconnect_failed', 'reconnect_error', 'error'].includes(event)) {
                    console.log(`WebSocketService: Received event '${event}':`, args);
                    try {
                        this.onMessageCallback!(event, ...args);
                    } catch (error) {
                        console.error(`WebSocketService: Error in generic onMessageCallback for '${event}' event`, error);
                    }
                 }
             });
        }
    }

    // Remove custom reconnection logic
    // private handleClose(event: CloseEvent): void { ... }
    // private attemptReconnection(closeCode?: number): void { ... }
    // private clearReconnectTimer(): void { ... }

    private handleError(error: Error): void { // Ensure error type is Error
        if (this.onErrorCallback) {
            try {
                this.onErrorCallback(error);
            } catch (callbackError) {
                console.error("WebSocketService: Error in onErrorCallback itself", callbackError);
            }
        }
    }

    // Update sendMessage to use emit
    /**
     * Emits an event with data to the server.
     * @param eventName The name of the event to emit.
     * @param args The data arguments to send with the event.
     * @returns boolean - True if the message was emitted or queued, false on error.
     */
    public sendMessage(eventName: string, ...args: any[]): boolean {
        if (this.socket && this.socket.connected) {
            try {
                this.socket.emit(eventName, ...args);
                // console.log(`WebSocketService: Emitted event '${eventName}'`);
                return true;
            } catch (error) {
                console.error(`WebSocketService: Failed to emit event '${eventName}'.`, error);
                this.handleError(error instanceof Error ? error : new Error(`Emit event '${eventName}' failed`));
                return false;
            }
        } else {
            console.warn(`WebSocketService: Cannot emit event '${eventName}', socket is not connected (state: ${this.status}).`);
            if (this.options.queueMessages) {
                console.log(`WebSocketService: Queuing event '${eventName}'.`);
                this.messageQueue.push({ event: eventName, data: args });
                return false; // Indicate message was queued
            } else {
                this.handleError(new Error(`Cannot emit event '${eventName}', socket state is ${this.status}`));
                return false;
            }
        }
    }

    // sendJsonMessage is now just sendMessage/emit
    // public sendJsonMessage(data: any): boolean { ... } // Remove or alias to sendMessage('message', data)

    // Update processMessageQueue for emit
    private processMessageQueue(): void {
        if (this.options.queueMessages && this.socket?.connected) {
            console.log(`WebSocketService: Processing ${this.messageQueue.length} queued messages...`);
            while (this.messageQueue.length > 0) {
                const item = this.messageQueue.shift(); // Get first message
                if (item) {
                    const sent = this.sendMessage(item.event, ...item.data);
                    if (!sent && !this.socket?.connected) {
                        // If sending failed and socket is no longer open, put message back and stop processing
                        console.warn("WebSocketService: Socket disconnected while processing queue. Re-queuing message.");
                        this.messageQueue.unshift(item);
                        break;
                    }
                }
            }
        }
    }


    // Update disconnect for Socket.IO
    public disconnect(preventReconnect: boolean = true): void {
        // Socket.IO's disconnect triggers the 'disconnect' event with reason 'io client disconnect'
        // It inherently prevents automatic reconnection for that specific instance.
        // Setting the explicitDisconnect flag ensures our logic doesn't try to reconnect later via AppState etc.
        if (preventReconnect) {
            this.explicitDisconnect = true;
             console.log("WebSocketService: Explicit disconnect requested. Socket.IO auto-reconnect disabled for this instance.");
        } else {
             console.log("WebSocketService: Internal disconnect requested.");
             // If we call disconnect() without the flag, Socket.IO might still reconnect if options allow?
             // Generally, disconnect() is for permanent closure.
        }

        if (this.socket) {
             if (this.socket.connected || this.socket.connecting) {
                 this.updateStatus(WebSocketStatus.CLOSING); // Conceptually closing
                 console.log("WebSocketService: Disconnecting Socket.IO connection...");
                 this.socket.disconnect();
             } else {
                  console.log(`WebSocketService: Socket.IO already disconnected.`);
                  // If already disconnected, ensure flag is set if needed
                  if (preventReconnect) this.explicitDisconnect = true;
             }
        } else {
            console.log("WebSocketService: No active Socket.IO connection to disconnect.");
             this.updateStatus(WebSocketStatus.CLOSED);
             if (preventReconnect) this.explicitDisconnect = true;
        }
    }

    public cleanup(): void {
        console.log("WebSocketService: Cleaning up Socket.IO service...");
        AppState.removeEventListener('change', this.handleAppStateChange);
        this.disconnect(true); // Ensure connection is closed and stays closed
        // Remove listeners from socket instance if it exists
        this.socket?.removeAllListeners();
        this.socket = null; // Release the socket instance
        // Nullify callbacks
        this.onMessageCallback = null;
        this.onOpenCallback = null;
        this.onCloseCallback = null;
        this.onErrorCallback = null;
        this.onStatusChangeCallback = null;
        this.messageQueue = [];
    }

    // AppState handling might need less intervention with Socket.IO's built-in reconnect
    private handleAppStateChange = (nextAppState: AppStateStatus) => {
        console.log(`WebSocketService: AppState changed to ${nextAppState}`);
        if (this.socket) {
            if (nextAppState === 'active') {
                // App came to foreground. Socket.IO might try to reconnect automatically if disconnected.
                // We could potentially force a connection attempt if desired and disconnected.
                if (!this.socket.connected && !this.explicitDisconnect && this.options.reconnection) {
                    console.log("WebSocketService: App active and socket disconnected, ensuring connection attempt...");
                    // Socket.IO usually handles this, but connect() ensures it if needed.
                    // Calling connect() might create a new socket if the old one is fully closed.
                    this.connect();
                } else {
                     console.log(`WebSocketService: App active. Socket status: ${this.socket.connected ? 'connected' : 'disconnected'}`);
                }
            } else {
                // App went to background. Socket.IO connection might drop depending on OS/settings.
                // Socket.IO's reconnection logic should handle resuming when app becomes active again.
                console.log("WebSocketService: App went to background.");
                // Optionally, disconnect manually if background connection is not desired:
                // if (this.socket.connected) this.socket.disconnect();
            }
        }
    };
}

// --- Example Usage (Updated for Socket.IO) ---
/*
const wsService = new WebSocketService('https://your-socketio-server.com', {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    queueMessages: true,
    // Example auth:
    // auth: async (cb) => {
    //    const token = await AsyncStorage.getItem('authToken');
    //    cb({ token: token || '' });
    // }
});

wsService.setOnStatusChange((status) => {
    console.log("App received status update:", status);
    // Update UI based on status
});

wsService.setOnOpen(() => {
    console.log("App knows connection is open!");
    // Emit events instead of sending JSON messages
    wsService.sendMessage('client:ping', { timestamp: Date.now() });
});

// Listen to specific events
wsService.on('server:pong', (data) => {
    console.log("App received pong:", data);
});

wsService.on('chat_message', (messageData) => {
    console.log("App received chat message:", messageData);
    // Display chat message
});

wsService.setOnError((error) => {
    console.error("App received error:", error.message);
});

wsService.setOnClose((reason) => {
    console.log("App knows connection closed:", reason);
});

// Connect explicitly if autoConnect was false
wsService.connect();

// Later, to send a message:
// wsService.sendMessage('send_message', { content: 'Hello Socket.IO!' });

// When the component/app unmounts or user logs out:
// wsService.cleanup();
*/
