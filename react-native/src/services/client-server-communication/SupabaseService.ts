/**
 * @file SupabaseService.ts
 * A service for interacting with Supabase, an open source Firebase alternative.
 * Provides access to Supabase's database, authentication, storage, and realtime capabilities.
 *
 * --- DETAILED INTERVIEW QUESTIONS ---
 *
 * **Core Supabase Concepts:**
 * - What is Supabase and how does it differ from Firebase? What are the advantages and disadvantages?
 * - Explain the architecture of Supabase. Which open-source tools does it build upon? (PostgreSQL, PostgREST, GoTrue, Realtime, Storage API)
 * - How does Supabase handle realtime functionality? Explain the underlying technology. (PostgreSQL's logical replication, Realtime server)
 * - Describe the authentication options in Supabase. How does it handle JWT tokens? (Email/Pass, Magic Link, OAuth, Phone Auth; JWT stored securely, auto-refreshed)
 * - How does Row Level Security (RLS) work in Supabase? Why is it important? (Policies on tables based on user roles/claims; critical for data security)
 * - Explain the relationship between PostgreSQL and Supabase. (Supabase provides tools/APIs on top of a standard PostgreSQL database)
 *
 * **Implementation Strategies:**
 * - How would you organize database access code when using Supabase in a React Native app? (Service class like this, hooks, context API)
 * - Compare querying data with Supabase's client library vs. using raw SQL or stored procedures. (Client library for ease/safety, SQL/RPC for complex logic/performance)
 * - How would you implement data pagination with Supabase? (`.range()` method)
 * - What strategies would you use for handling offline capabilities with Supabase? (Local caching, state management libraries, potential third-party sync solutions)
 * - How would you implement complex database relationships in Supabase? (Foreign keys, views, RPC functions)
 * - How would you manage file uploads using Supabase Storage? (Client library methods, RLS for buckets/objects)
 * - Explain how to implement full-text search in Supabase. (PostgreSQL's built-in FTS features, `tsvector`, `tsquery`)
 *
 * **React Native Specific:**
 * - What are the specific considerations for using Supabase in React Native compared to web? (Native modules like AsyncStorage, platform-specific OAuth handling, background tasks)
 * - How would you handle authentication flows in a React Native app with Supabase? (Navigation based on auth state, secure token storage)
 * - How do you optimize Supabase performance in a React Native application? (Indexing, selective queries, pagination, local caching)
 * - What libraries or patterns would you use to integrate Supabase with React Native state management? (Context API, Zustand, Redux Toolkit with listeners/thunks)
 * - How would you implement push notifications alongside Supabase? (Edge Functions triggering a notification service like OneSignal, Firebase Cloud Messaging, Expo Push Notifications)
 * - What are the best practices for testing Supabase functionality in React Native apps? (Mocking the client, integration tests with a test database)
 *
 * **Advanced Supabase:**
 * - How would you implement custom server-side logic with Supabase? (PostgreSQL functions (RPC), Edge Functions (Deno))
 * - What are the security best practices when using Supabase? (RLS, secure functions, environment variables, input validation, rate limiting)
 * - How would you handle database migrations and schema changes in a Supabase project? (Supabase CLI, SQL migration files, staging environments)
 * - What strategies would you use for database backup and disaster recovery with Supabase? (Built-in backups, Point-in-Time Recovery (PITR), manual backups)
 * - How would you implement multi-tenancy in a Supabase application? (RLS based on tenant ID, separate schemas, separate databases)
 * - How would you optimize query performance in a large-scale Supabase application? (Indexing, query analysis (`EXPLAIN`), connection pooling, read replicas)
 * - Explain how you would use Supabase's realtime features for collaborative applications. (Presence tracking, broadcasting changes, CRDTs)
 * - How would you implement custom webhook handlers with Supabase? (Edge Functions, external services triggered by database webhooks/triggers)
 */

// Actual Supabase imports
import { createClient, SupabaseClient, User, AuthChangeEvent, Session, RealtimeChannel, PostgrestError, AuthError, StorageError } from '@supabase/supabase-js';
// Note: react-native-supabase is deprecated, use @supabase/supabase-js directly with AsyncStorage
// import { createSupabaseClient } from 'react-native-supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AppState } from 'react-native'; // For handling app state changes with realtime subscriptions

// --- Configuration ---
// IMPORTANT: Replace with your actual Supabase URL and Anon Key
// It's best practice to store these in environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn("Supabase URL or Anon Key is not set. Please configure them.");
}

// --- Supabase Client Initialization ---
// Use AsyncStorage for token persistence in React Native
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Important for React Native
    },
    // Optional: Configure realtime options if needed
    // realtime: {
    //   params: {
    //     eventsPerSecond: 10,
    //   },
    // },
});

// --- Supabase Service Class ---

class SupabaseService {
    private client: SupabaseClient;
    private realtimeChannels: Map<string, RealtimeChannel> = new Map();

    constructor() {
        this.client = supabase;

        // Reconnect Realtime channels on AppState change
        // Fixes issues where WebSocket connections might drop on app backgrounding/foregrounding
        AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('App has come to the foreground! Reconnecting Supabase Realtime channels.');
                this.client.realtime.connect();
                // Optionally, re-subscribe to channels if needed, though connect() often handles this.
            } else {
                 console.log('App has gone to the background. Supabase Realtime might disconnect.');
                 // Supabase client handles disconnection automatically in most cases.
                 // You might explicitly disconnect if needed: this.client.realtime.disconnect();
            }
        });
    }

    // --- Authentication ---

    /**
     * Get the current logged-in user.
     * @returns {Promise<User | null>} The user object or null if not logged in.
     */
    async getCurrentUser(): Promise<User | null> {
        const { data: { session } } = await this.client.auth.getSession();
        return session?.user ?? null;
    }

    /**
     * Get the current session details.
     * @returns {Promise<Session | null>} The session object or null.
     */
     async getSession(): Promise<Session | null> {
        const { data: { session } } = await this.client.auth.getSession();
        return session;
    }


    /**
     * Sign up a new user with email and password.
     * @param {string} email - User's email.
     * @param {string} password - User's password.
     * @returns {Promise<{ user: User | null; error: AuthError | null }>} Result object.
     */
    async signUpWithPassword(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
        const { data, error } = await this.client.auth.signUp({ email, password });
        // Note: By default, Supabase might require email confirmation.
        return { user: data.user, error };
    }

    /**
     * Sign in a user with email and password.
     * @param {string} email - User's email.
     * @param {string} password - User's password.
     * @returns {Promise<{ user: User | null; session: Session | null; error: AuthError | null }>} Result object.
     */
    async signInWithPassword(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: AuthError | null }> {
        const { data, error } = await this.client.auth.signInWithPassword({ email, password });
        return { user: data?.user ?? null, session: data?.session ?? null, error };
    }

    /**
     * Sign in a user using OAuth provider.
     * This often requires platform-specific setup (Deep Linking, WebBrowser).
     * @param {'google' | 'apple' | 'github' | string} provider - OAuth provider name.
     * @returns {Promise<{ url: string | null; error: AuthError | null }>} URL for OAuth flow or error.
     */
    async signInWithOAuth(provider: 'google' | 'apple' | 'github' | string): Promise<{ url: string | null; error: AuthError | null }> {
       // For React Native, you typically need to handle the OAuth flow using
       // libraries like react-native-web-browser or react-native-inappbrowser-reborn
       // and configure Deep Linking (URL Schemes / Universal Links) to get the session back.
       console.warn("signInWithOAuth requires platform-specific handling with Deep Linking and a Web Browser.");
       const { data, error } = await this.client.auth.signInWithOAuth({
           provider: provider as any, // Cast needed as Supabase types might be stricter
           options: {
               // redirectTo: 'YOUR_APP_DEEP_LINK_SCHEME://callback', // Example deep link
               skipBrowserRedirect: true, // Important for manual handling in RN
           },
       });
       // You'd typically open data.url in a browser/webview and handle the redirect.
       return { url: data?.url ?? null, error };
    }

     /**
     * Sign out the current user.
     * @returns {Promise<{ error: AuthError | null }>} Result object.
     */
    async signOut(): Promise<{ error: AuthError | null }> {
        const { error } = await this.client.auth.signOut();
        this.removeAllRealtimeSubscriptions(); // Clean up subscriptions on sign out
        return { error };
    }

    /**
     * Listen to authentication state changes (SIGNED_IN, SIGNED_OUT, etc.).
     * @param {(event: AuthChangeEvent, session: Session | null) => void} callback - Function to call on auth state change.
     * @returns {{ data: { subscription: { unsubscribe: () => void } } }} Subscription object to unsubscribe later.
     */
    onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
        const { data: { subscription } } = this.client.auth.onAuthStateChange(callback);
        return subscription;
    }

    /**
     * Send a password reset email.
     * @param {string} email - The user's email address.
     * @returns {Promise<{ error: AuthError | null }>} Result object.
     */
    async sendPasswordResetEmail(email: string): Promise<{ error: AuthError | null }> {
        // You might need to configure a redirect URL in your Supabase project settings
        // for where the user should be sent after clicking the reset link.
        const { error } = await this.client.auth.resetPasswordForEmail(email, {
            // redirectTo: 'YOUR_APP_PASSWORD_RESET_SCREEN_DEEP_LINK', // Optional deep link
        });
        return { error };
    }

     /**
     * Update user password when they are logged in.
     * @param {string} newPassword - The new password.
     * @returns {Promise<{ user: User | null; error: AuthError | null }>} Result object.
     */
    async updateUserPassword(newPassword: string): Promise<{ user: User | null; error: AuthError | null }> {
        const { data, error } = await this.client.auth.updateUser({ password: newPassword });
        return { user: data.user, error };
    }


    // --- Database Operations (CRUD) ---
    // Assumes RLS is set up in your Supabase project.

    /**
     * Fetch multiple records from a table.
     * @template T - The expected type of the data array.
     * @param {string} tableName - The name of the table.
     * @param {object} [options] - Optional query parameters (e.g., filters, select, order, range).
     * @param {string} [options.select='*'] - Columns to select.
     * @param {Record<string, any>} [options.filters] - Filters to apply (e.g., { column: 'eq.value' }).
     * @param {string} [options.order] - Column to order by.
     * @param {boolean} [options.ascending=true] - Order direction.
     * @param {number} [options.limit] - Max number of rows to return.
     * @param {number} [options.offset] - Number of rows to skip (for pagination).
     * @returns {Promise<{ data: T[] | null; error: PostgrestError | null }>} Result object.
     */
    async fetchItems<T>(
        tableName: string,
        options?: {
            select?: string;
            filters?: Record<string, { operator: string; value: any }>; // e.g. { status: { operator: 'eq', value: 'active' } }
            order?: string;
            ascending?: boolean;
            limit?: number;
            offset?: number; // For pagination: offset = (page - 1) * limit
        }
    ): Promise<{ data: T[] | null; error: PostgrestError | null }> {
        let query = this.client.from(tableName).select(options?.select ?? '*');

        if (options?.filters) {
            Object.entries(options.filters).forEach(([column, filter]) => {
                query = query[filter.operator](column, filter.value); // e.g., query.eq('status', 'active')
            });
        }
        if (options?.order) {
            query = query.order(options.order, { ascending: options.ascending ?? true });
        }
        if (options?.limit !== undefined && options?.offset !== undefined) {
             // Pagination using range
            query = query.range(options.offset, options.offset + options.limit - 1);
        } else if (options?.limit !== undefined) {
            query = query.limit(options.limit);
        }


        const { data, error } = await query;
        return { data: data as T[] | null, error };
    }

    /**
     * Fetch a single record by its ID.
     * @template T - The expected type of the data.
     * @param {string} tableName - The name of the table.
     * @param {string | number} id - The primary key ID of the record.
     * @param {string} [select='*'] - Columns to select.
     * @returns {Promise<{ data: T | null; error: PostgrestError | null }>} Result object.
     */
    async fetchItemById<T>(tableName: string, id: string | number, select: string = '*'): Promise<{ data: T | null; error: PostgrestError | null }> {
        const { data, error } = await this.client
            .from(tableName)
            .select(select)
            .eq('id', id)
            .single(); // .single() expects exactly one row or returns an error
        return { data: data as T | null, error };
    }

    /**
     * Insert a new record into a table.
     * @template T - The type of the data being inserted.
     * @template R - The expected return type after insertion.
     * @param {string} tableName - The name of the table.
     * @param {T} itemData - The data object to insert.
     * @param {string} [select='*'] - Columns to select after insertion.
     * @returns {Promise<{ data: R | null; error: PostgrestError | null }>} Result object with the inserted data.
     */
    async insertItem<T, R = T>(tableName: string, itemData: T, select: string = '*'): Promise<{ data: R | null; error: PostgrestError | null }> {
        const { data, error } = await this.client
            .from(tableName)
            .insert(itemData as any) // Cast might be needed depending on T
            .select(select)
            .single(); // Assuming insertion returns the single created row
        return { data: data as R | null, error };
    }

    /**
     * Update an existing record in a table.
     * @template T - The type of the data being updated.
     * @template R - The expected return type after update.
     * @param {string} tableName - The name of the table.
     * @param {string | number} id - The ID of the record to update.
     * @param {Partial<T>} itemData - The data fields to update.
     * @param {string} [select='*'] - Columns to select after update.
     * @returns {Promise<{ data: R | null; error: PostgrestError | null }>} Result object with the updated data.
     */
    async updateItem<T, R = T>(tableName: string, id: string | number, itemData: Partial<T>, select: string = '*'): Promise<{ data: R | null; error: PostgrestError | null }> {
        const { data, error } = await this.client
            .from(tableName)
            .update(itemData as any) // Cast might be needed
            .eq('id', id)
            .select(select)
            .single(); // Assuming update returns the single updated row
        return { data: data as R | null, error };
    }

    /**
     * Delete a record from a table.
     * @param {string} tableName - The name of the table.
     * @param {string | number} id - The ID of the record to delete.
     * @returns {Promise<{ error: PostgrestError | null }>} Result object.
     */
    async deleteItem(tableName: string, id: string | number): Promise<{ error: PostgrestError | null }> {
        const { error } = await this.client
            .from(tableName)
            .delete()
            .eq('id', id);
        return { error };
    }

    /**
     * Call a PostgreSQL function (RPC).
     * @template T - The expected return type of the function.
     * @param {string} functionName - The name of the function in your database.
     * @param {object} [args={}] - Arguments to pass to the function.
     * @returns {Promise<{ data: T | null; error: PostgrestError | null }>} Result object.
     */
    async callRpc<T>(functionName: string, args: object = {}): Promise<{ data: T | null; error: PostgrestError | null }> {
        const { data, error } = await this.client.rpc(functionName, args);
        return { data: data as T | null, error };
    }


    // --- Real-time Subscriptions ---

    /**
     * Subscribe to changes in a specific table.
     * @param {string} tableName - The table to subscribe to.
     * @param {(payload: any) => void} callback - Function to execute when a change occurs.
     * @param {string} [schema='public'] - The database schema.
     * @param {Record<string, string>} [filter] - Optional filter (e.g., { event: 'INSERT' }, { filter: 'id=eq.123' }).
     * @returns {RealtimeChannel | null} The channel object for unsubscribing, or null on error.
     */
    subscribeToTableChanges(
        tableName: string,
        callback: (payload: any) => void,
        schema: string = 'public',
        filter?: Record<string, string>
    ): RealtimeChannel | null {
        const channelId = `table:${schema}:${tableName}:${JSON.stringify(filter || {})}`;
        if (this.realtimeChannels.has(channelId)) {
            console.warn(`Already subscribed to ${channelId}. Returning existing channel.`);
            return this.realtimeChannels.get(channelId) || null;
        }

        try {
            const channel = this.client
                .channel(`db-${tableName}-changes-${Date.now()}`) // Unique channel name
                .on(
                    'postgres_changes',
                    {
                        event: '*', // Subscribe to INSERT, UPDATE, DELETE
                        schema: schema,
                        table: tableName,
                        // filter: filter // e.g., 'id=eq.some_value'
                        ...(filter && { filter: filter.filter }), // Apply filter if provided
                    },
                    (payload) => {
                        console.log(`Realtime change received on ${tableName}:`, payload);
                        callback(payload);
                    }
                )
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        console.log(`Successfully subscribed to ${channelId}`);
                    }
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.error(`Subscription error on ${channelId}:`, err || status);
                        // Optional: Implement retry logic here
                        this.removeRealtimeSubscription(channelId); // Clean up failed channel
                    }
                     if (status === 'CLOSED') {
                        console.log(`Subscription closed for ${channelId}`);
                        // Usually closed intentionally via unsubscribe()
                    }
                });

            this.realtimeChannels.set(channelId, channel);
            return channel;
        } catch (error) {
            console.error(`Failed to create subscription channel for ${channelId}:`, error);
            return null;
        }
    }

    /**
     * Unsubscribe from a specific real-time channel using its ID.
     * @param {string} channelId - The ID used when subscribing (e.g., `table:public:todos:{}`).
     */
    async removeRealtimeSubscription(channelId: string): Promise<void> {
        const channel = this.realtimeChannels.get(channelId);
        if (channel) {
            try {
                const status = await channel.unsubscribe();
                console.log(`Unsubscribed from ${channelId}, status: ${status}`);
            } catch (error) {
                console.error(`Error unsubscribing from ${channelId}:`, error);
            } finally {
                 this.realtimeChannels.delete(channelId);
                 // Also remove from Supabase client's internal list if possible/needed
                 this.client.removeChannel(channel);
            }
        } else {
             console.warn(`No active subscription found for ID: ${channelId}`);
        }
    }

    /**
     * Unsubscribe from all active real-time channels.
     */
    async removeAllRealtimeSubscriptions(): Promise<void> {
        console.log(`Removing all (${this.realtimeChannels.size}) realtime subscriptions.`);
        // Create a copy of keys to avoid issues while iterating and deleting
        const channelIds = Array.from(this.realtimeChannels.keys());
        for (const channelId of channelIds) {
            await this.removeRealtimeSubscription(channelId);
        }
         // Fallback: ensure all channels known to the client are removed
        await this.client.removeAllChannels();
        this.realtimeChannels.clear(); // Clear the map
    }


    // --- Storage ---
    // Assumes RLS is set up for storage buckets/objects.

    /**
     * List files in a storage bucket.
     * @param {string} bucketName - The name of the bucket.
     * @param {string} [path=''] - The folder path within the bucket.
     * @param {object} [options] - Options like limit, offset, search.
     * @returns {Promise<{ data: FileObject[] | null; error: StorageError | null }>} List of files or error.
     */
    async listFiles(bucketName: string, path: string = '', options?: { limit?: number; offset?: number; search?: string }): Promise<{ data: any[] | null; error: StorageError | null }> {
        const { data, error } = await this.client.storage
            .from(bucketName)
            .list(path, options);
        return { data, error };
    }


    /**
     * Upload a file to Supabase Storage.
     * In React Native, 'file' is typically an object with uri, type, and name.
     * @param {string} bucketName - The name of the bucket.
     * @param {string} filePathInBucket - The desired path and filename in the bucket (e.g., 'avatars/user123.png').
     * @param {any} file - The file object (e.g., from react-native-document-picker or react-native-image-picker). Needs { uri: string, type: string, name: string }.
     * @param {object} [options] - Upload options like cacheControl, contentType, upsert.
     * @returns {Promise<{ data: { path: string } | null; error: StorageError | null }>} Upload result or error.
     */
    async uploadFile(bucketName: string, filePathInBucket: string, file: { uri: string, type: string, name: string }, options?: { cacheControl?: string; contentType?: string; upsert?: boolean }): Promise<{ data: { path: string } | null; error: Error | StorageError | null }> {
       // React Native requires fetching the file content first (e.g., as Blob or ArrayBuffer)
       try {
            const response = await fetch(file.uri);
            const blob = await response.blob(); // Get file content as Blob

            // Use FormData for robust upload, especially for larger files
            const formData = new FormData();
            formData.append('file', blob, file.name); // Use the blob here

            const { data, error } = await this.client.storage
                .from(bucketName)
                .upload(filePathInBucket, formData, { // Pass FormData directly
                    cacheControl: options?.cacheControl ?? '3600',
                    upsert: options?.upsert ?? false,
                    // contentType: file.type, // ContentType is often inferred from FormData/Blob
                    ...options,
                });

            if (error) {
                 console.error("Supabase Storage Upload Error:", error);
                 return { data: null, error };
            }

            // Note: The 'path' returned by upload might just be the key (filePathInBucket).
            // It's not the full public URL.
            return { data: data ? { path: data.path } : null, error: null };

       } catch (err: any) {
            console.error("Error fetching or uploading file:", err);
            return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
       }
    }


    /**
     * Download a file from Supabase Storage.
     * @param {string} bucketName - The name of the bucket.
     * @param {string} filePathInBucket - The path to the file in the bucket.
     * @returns {Promise<{ data: Blob | null; error: StorageError | null }>} File content as Blob or error.
     */
    async downloadFile(bucketName: string, filePathInBucket: string): Promise<{ data: Blob | null; error: StorageError | null }> {
        const { data, error } = await this.client.storage
            .from(bucketName)
            .download(filePathInBucket);
        return { data, error };
    }

    /**
     * Get the public URL for a file (if bucket permissions allow).
     * @param {string} bucketName - The name of the bucket.
     * @param {string} filePathInBucket - The path to the file in the bucket.
     * @param {object} [options] - Options like download (force download) or transformation (image resizing).
     * @returns {{ data: { publicUrl: string } }} Object containing the public URL.
     */
    getPublicUrl(bucketName: string, filePathInBucket: string, options?: { download?: boolean | string; transform?: { width?: number; height?: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' } }): { data: { publicUrl: string } } {
        const { data } = this.client.storage
            .from(bucketName)
            .getPublicUrl(filePathInBucket, options);
        return { data };
    }

     /**
     * Get a temporary signed URL for a file (useful for private files).
     * @param {string} bucketName - The name of the bucket.
     * @param {string} filePathInBucket - The path to the file in the bucket.
     * @param {number} expiresInSeconds - How long the URL should be valid.
     * @param {object} [options] - Options like download or transformation.
     * @returns {Promise<{ data: { signedUrl: string } | null; error: StorageError | null }>} Signed URL or error.
     */
    async createSignedUrl(bucketName: string, filePathInBucket: string, expiresInSeconds: number, options?: { download?: boolean | string; transform?: { width?: number; height?: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' } }): Promise<{ data: { signedUrl: string } | null; error: StorageError | null }> {
        const { data, error } = await this.client.storage
            .from(bucketName)
            .createSignedUrl(filePathInBucket, expiresInSeconds, options);
        return { data, error };
    }


    /**
     * Delete a file from Supabase Storage.
     * @param {string} bucketName - The name of the bucket.
     * @param {string[]} filePathsInBucket - An array of file paths to delete.
     * @returns {Promise<{ data: any[] | null; error: StorageError | null }>} Result of deletion or error.
     */
    async deleteFiles(bucketName: string, filePathsInBucket: string[]): Promise<{ data: any[] | null; error: StorageError | null }> {
        const { data, error } = await this.client.storage
            .from(bucketName)
            .remove(filePathsInBucket);
        return { data, error };
    }

    // --- Edge Functions ---

    /**
     * Invoke a Supabase Edge Function.
     * @template T - Expected response data type.
     * @param {string} functionName - The name of the Edge Function.
     * @param {object} [options] - Options including body, headers, method.
     * @param {any} [options.body] - Request body.
     * @param {Record<string, string>} [options.headers] - Custom headers.
     * @param {'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH'} [options.method='POST'] - HTTP method.
     * @returns {Promise<{ data: T | null; error: Error | null }>} Response data or error.
     */
    async invokeEdgeFunction<T>(
        functionName: string,
        options?: {
            body?: any;
            headers?: Record<string, string>;
            method?: 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH';
        }
    ): Promise<{ data: T | null; error: Error | null }> {
        const { data, error } = await this.client.functions.invoke<T>(functionName, {
            body: options?.body,
            headers: options?.headers,
            method: options?.method ?? 'POST',
        });

        // The 'error' object from functions.invoke might be different from PostgrestError or AuthError
        if (error) {
            console.error(`Edge function '${functionName}' invocation error:`, error);
            // Ensure it's an Error object
            return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
        }

        return { data: data ?? null, error: null };
    }
}

// --- Export Singleton Instance ---
// Export a single instance of the service for use throughout the app
export const supabaseService = new SupabaseService();

// --- Example Usage (for demonstration) ---
/*
async function exampleUsage() {
    // Auth
    const { user, error: signUpError } = await supabaseService.signUpWithPassword('test@example.com', 'password123');
    if (signUpError) console.error("Sign up failed:", signUpError.message);
    else console.log("Signed up user:", user?.email);

    const { session, error: signInError } = await supabaseService.signInWithPassword('test@example.com', 'password123');
    if (signInError) console.error("Sign in failed:", signInError.message);
    else console.log("Signed in session:", session?.access_token.substring(0, 10) + "...");

    const currentUser = await supabaseService.getCurrentUser();
    console.log("Current user:", currentUser?.id);

    // Database (assuming a 'todos' table exists with RLS allowing authenticated users)
    if (currentUser) {
        const { data: newTodo, error: insertError } = await supabaseService.insertItem<{ title: string; user_id: string }, { id: number; title: string }>('todos', { title: 'My First Todo', user_id: currentUser.id });
        if (insertError) console.error("Insert failed:", insertError.message);
        else console.log("Inserted todo:", newTodo);

        if (newTodo) {
            const { data: updatedTodo, error: updateError } = await supabaseService.updateItem('todos', newTodo.id, { title: 'My Updated Todo' });
            if (updateError) console.error("Update failed:", updateError.message);
            else console.log("Updated todo:", updatedTodo);
        }

        const { data: todos, error: fetchError } = await supabaseService.fetchItems<{ id: number; title: string; user_id: string }>('todos', { filters: { user_id: { operator: 'eq', value: currentUser.id } }, order: 'created_at', ascending: false, limit: 10 });
        if (fetchError) console.error("Fetch failed:", fetchError.message);
        else console.log("Fetched todos:", todos);

        // Realtime (example - listen for new todos for the current user)
        const todoSubscription = supabaseService.subscribeToTableChanges(
            'todos',
            (payload) => {
                console.log("Realtime Todo Change:", payload);
                // Update UI based on payload (e.g., payload.new, payload.old, payload.eventType)
            },
            'public',
            // { filter: `user_id=eq.${currentUser.id}` } // Filter on the server-side if possible
        );

        // Remember to unsubscribe when the component unmounts or user logs out
        // await supabaseService.removeRealtimeSubscription('table:public:todos:...'); // Use the correct ID or channel object
    }


    // Sign out
    // await supabaseService.signOut();
    // console.log("User signed out.");
}

// exampleUsage(); // Don't run automatically, just for illustration
*/

