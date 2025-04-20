/**
 * @file FirebaseService.ts
 * A service for Firebase Realtime Database and Cloud Firestore interactions in React Native.
 * Provides unified access to Firebase's real-time data capabilities.
 * 
 * --- DETAILED INTERVIEW QUESTIONS ---
 *
 * **Core Firebase Database Concepts:**
 * - Compare Firebase Realtime Database vs. Cloud Firestore. What are the key differences in data structure, querying capabilities, and scaling?
 * - Explain Firebase's data model (documents, collections in Firestore; JSON tree in Realtime DB).
 * - How does Firebase handle offline data persistence? How do you configure offline capabilities?
 * - What are security rules in Firebase? How do they differ between Realtime DB and Firestore?
 * - What is the maximum size of a document in Firestore? What are the limitations of nested data?
 * - How does indexing work in Firebase? When do you need to create custom indexes?
 * 
 * **Implementation Strategies:**
 * - How would you structure data in Firestore for efficient queries? Discuss denormalization vs. normalization.
 * - What strategies would you use to paginate large datasets in Firestore? Compare limit(), startAfter() methods.
 * - How would you implement complex queries in Firestore that aren't directly supported (OR queries, NOT queries)?
 * - Explain transaction and batch writes in Firebase. When would you use each?
 * - How do you handle file uploads with Firebase Storage? How would you associate files with database documents?
 * - What patterns would you use for many-to-many relationships in Firestore?
 * - How would you implement a search functionality with Firestore (considering its limitations)?
 * 
 * **React Native Specific:**
 * - How do you handle Firebase authentication in React Native?
 * - What are the challenges of using Firebase in React Native compared to web?
 * - How would you optimize Firebase performance in a React Native app?
 * - Compare different Firebase React Native libraries (firebase vs react-native-firebase).
 * - How do you handle push notifications with Firebase Cloud Messaging in React Native?
 * - How do you test Firebase functionality in a React Native app?
 * 
 * **Advanced Firebase:**
 * - How would you implement real-time updates efficiently in a complex app? How do you manage listeners?
 * - How would you implement custom server-side validation beyond security rules (Cloud Functions)?
 * - What strategies would you use for handling data migrations or schema changes in Firebase?
 * - How would you implement role-based access control with Firebase Authentication and security rules?
 * - How do you optimize costs when using Firebase services? What usage patterns should be avoided?
 * - How would you implement custom analytics events with Firebase Analytics?
 * - Discuss strategies for scaling Firebase as your application grows. What are potential bottlenecks?
 * - How would you implement a multi-tenant architecture using Firebase?
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Actual Firebase imports
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/database';
import 'firebase/storage';

// Mock Firebase types for demonstration
interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface FirebaseApp {
  name: string;
}

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
}

// Simulated Query and Document interfaces
interface FirestoreQuery {
  where: (field: string, operator: string, value: any) => FirestoreQuery;
  orderBy: (field: string, direction?: 'asc' | 'desc') => FirestoreQuery;
  limit: (limit: number) => FirestoreQuery;
  startAfter: (doc: any) => FirestoreQuery;
  get: () => Promise<FirestoreQuerySnapshot>;
  onSnapshot: (callback: (snapshot: FirestoreQuerySnapshot) => void) => () => void;
}

interface FirestoreQuerySnapshot {
  docs: FirestoreDocumentSnapshot[];
  empty: boolean;
  size: number;
}

interface FirestoreDocumentSnapshot {
  id: string;
  exists: boolean;
  data: () => any;
}

interface FirestoreDocumentReference {
  id: string;
  get: () => Promise<FirestoreDocumentSnapshot>;
  set: (data: any, options?: { merge?: boolean }) => Promise<void>;
  update: (data: any) => Promise<void>;
  delete: () => Promise<void>;
  onSnapshot: (callback: (snapshot: FirestoreDocumentSnapshot) => void) => () => void;
}

interface FirestoreCollection {
  doc: (path?: string) => FirestoreDocumentReference;
  add: (data: any) => Promise<FirestoreDocumentReference>;
  where: (field: string, operator: string, value: any) => FirestoreQuery;
  orderBy: (field: string, direction?: 'asc' | 'desc') => FirestoreQuery;
  limit: (limit: number) => FirestoreQuery;
}

interface RealtimeDBReference {
  set: (value: any) => Promise<void>;
  update: (values: Record<string, any>) => Promise<void>;
  remove: () => Promise<void>;
  push: () => RealtimeDBReference;
  once: (eventType: string) => Promise<any>;
  on: (eventType: string, callback: (snapshot: any) => void) => void;
  off: (eventType?: string, callback?: Function) => void;
}

/**
 * Service for Firebase Realtime Database and Cloud Firestore
 * Interview Question: How would you design a service to unify both Firebase database options?
 */
class FirebaseService {
  private static instance: FirebaseService;
  private app: FirebaseApp | null = null;
  private isInitialized: boolean = false;
  private config: FirebaseConfig | null = null;
  
  // Track active listeners for cleanup
  private firestoreListeners: Map<string, () => void> = new Map();
  private realtimeListeners: Map<string, { ref: RealtimeDBReference; eventType: string; callback: Function }> = new Map();
  
  // Mock user authentication state
  private currentUser: FirebaseUser | null = null;
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get the singleton instance of FirebaseService
   */
  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }
  
  /**
   * Initialize Firebase with configuration
   * @param config Firebase configuration object
   * Interview Question: What security concerns exist with Firebase config in client code?
   */
  public initialize(config: FirebaseConfig): void {
    if (this.isInitialized) {
      console.log('Firebase is already initialized');
      return;
    }
    
    this.config = config;
    
    // Use actual Firebase initialization
    if (!firebase.apps.length) {
      this.app = firebase.initializeApp(config);
    } else {
      this.app = firebase.app();
    }
    
    this.isInitialized = true;
    
    console.log('Firebase initialized successfully');
    
    // Set up auth state listener
    this.setupAuthStateListener();
    
    // Configure offline persistence for Firestore
    this.enableOfflinePersistence();
  }
  
  /**
   * Configure auth state change listener
   * Interview Question: How would you handle authentication state across app restarts?
   */
  private setupAuthStateListener(): void {
    // Use actual Firebase auth state change listener
    firebase.auth().onAuthStateChanged((user) => {
      this.currentUser = user as FirebaseUser;
    });
  }
  
  /**
   * Enable offline data persistence for Firestore
   * Interview Question: What are the considerations for enabling offline persistence?
   */
  private enableOfflinePersistence(): void {
    // Enable actual Firestore offline persistence
    firebase.firestore().enablePersistence({ synchronizeTabs: true })
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
          console.warn('The current browser does not support all of the features required to enable persistence.');
        }
      });
    
    console.log('Offline persistence enabled');
  }
  
  /**
   * Get current authenticated user
   * @returns The current Firebase user or null if not authenticated
   */
  public getCurrentUser(): FirebaseUser | null {
    return this.currentUser;
  }
  
  /**
   * Sign in with email and password
   * @param email User email
   * @param password User password
   * @returns Promise resolving to user credentials
   * Interview Question: How would you handle token refresh and persistence?
   */
  public async signInWithEmailAndPassword(email: string, password: string): Promise<FirebaseUser> {
    this.checkInitialization();
    
    // Use actual Firebase authentication
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    return userCredential.user as FirebaseUser;
  }
  
  /**
   * Sign out the current user
   * @returns Promise that resolves when sign-out is complete
   */
  public async signOut(): Promise<void> {
    this.checkInitialization();
    
    // Use actual Firebase auth signOut
    await firebase.auth().signOut();
  }
  
  /**
   * Get a Firestore collection reference
   * @param path Path to the collection
   * @returns Firestore collection reference
   * Interview Question: How would you organize collections in a complex app?
   */
  public firestore(collectionPath: string): FirestoreCollection {
    this.checkInitialization();
    
    // Use actual Firebase Firestore collection
    return firebase.firestore().collection(collectionPath) as unknown as FirestoreCollection;
  }
  
  /**
   * Get a Realtime Database reference
   * @param path Path to the database location
   * @returns Realtime Database reference
   * Interview Question: When would you choose Realtime DB over Firestore?
   */
  public realtimeDB(path: string): RealtimeDBReference {
    this.checkInitialization();
    
    if (!this.config?.databaseURL) {
      throw new Error('Firebase Realtime Database URL not provided in config');
    }
    
    // Use actual Firebase Realtime Database reference
    return firebase.database().ref(path) as unknown as RealtimeDBReference;
  }
  
  /**
   * Perform a batch write operation in Firestore
   * @param operations Function that defines the batch operations
   * @returns Promise that resolves when the batch is committed
   * Interview Question: How would you handle batch write failures and rollbacks?
   */
  public async performBatchOperation(operations: (batch: any) => void): Promise<void> {
    this.checkInitialization();
    
    // In a real implementation:
    // const batch = firebase.firestore().batch();
    // operations(batch);
    // return batch.commit();
    
    // Mock implementation
    const mockBatch = {
      set: (docRef: any, data: any) => {
        console.log(`Batch: Set ${docRef.id} with data`, data);
        return mockBatch;
      },
      update: (docRef: any, data: any) => {
        console.log(`Batch: Update ${docRef.id} with data`, data);
        return mockBatch;
      },
      delete: (docRef: any) => {
        console.log(`Batch: Delete ${docRef.id}`);
        return mockBatch;
      }
    };
    
    operations(mockBatch);
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    console.log('Batch operation completed');
  }
  
  /**
   * Run a transaction in Firestore
   * @param updateFunction Function to execute within the transaction
   * @returns Promise with transaction result
   * Interview Question: What are the limitations of Firestore transactions?
   */
  public async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    this.checkInitialization();
    
    // In a real implementation:
    // return firebase.firestore().runTransaction(updateFunction);
    
    // Mock implementation
    const mockTransaction = {
      get: async (docRef: any) => {
        console.log(`Transaction: Get ${docRef.id}`);
        return { id: docRef.id, data: () => ({ mockData: 'value' }), exists: true };
      },
      set: (docRef: any, data: any) => {
        console.log(`Transaction: Set ${docRef.id} with data`, data);
        return mockTransaction;
      },
      update: (docRef: any, data: any) => {
        console.log(`Transaction: Update ${docRef.id} with data`, data);
        return mockTransaction;
      },
      delete: (docRef: any) => {
        console.log(`Transaction: Delete ${docRef.id}`);
        return mockTransaction;
      }
    };
    
    return updateFunction(mockTransaction);
  }
  
  /**
   * Add a document listener and track it for later cleanup
   * @param docRef Document reference to listen to
   * @param callback Function to call with document updates
   * @param id Optional identifier for this listener
   * @returns Function to remove the listener
   * Interview Question: How would you manage multiple listeners in a complex app?
   */
  public addDocumentListener(docRef: FirestoreDocumentReference, callback: (doc: any) => void, id?: string): () => void {
    const listenerId = id || `doc_${docRef.id}_${Date.now()}`;
    
    // Add the listener
    const unsubscribe = docRef.onSnapshot((doc) => {
      callback(doc);
    });
    
    // Store for later cleanup
    this.firestoreListeners.set(listenerId, unsubscribe);
    
    return () => {
      unsubscribe();
      this.firestoreListeners.delete(listenerId);
    };
  }
  
  /**
   * Add a query listener and track it for later cleanup
   * @param query Firestore query to listen to
   * @param callback Function to call with query results
   * @param id Optional identifier for this listener
   * @returns Function to remove the listener
   */
  public addQueryListener(query: FirestoreQuery, callback: (docs: any[]) => void, id?: string): () => void {
    const listenerId = id || `query_${Date.now()}`;
    
    // Add the listener
    const unsubscribe = query.onSnapshot((snapshot) => {
      callback(snapshot.docs);
    });
    
    // Store for later cleanup
    this.firestoreListeners.set(listenerId, unsubscribe);
    
    return () => {
      unsubscribe();
      this.firestoreListeners.delete(listenerId);
    };
  }
  
  /**
   * Add a Realtime Database listener and track it for later cleanup
   * @param ref Database reference to listen to
   * @param eventType Event type ('value', 'child_added', etc)
   * @param callback Function to call with updates
   * @param id Optional identifier for this listener
   * @returns Function to remove the listener
   */
  public addRealtimeListener(
    ref: RealtimeDBReference, 
    eventType: string, 
    callback: (snapshot: any) => void, 
    id?: string
  ): () => void {
    const listenerId = id || `rtdb_${eventType}_${Date.now()}`;
    
    // Add the listener
    ref.on(eventType, callback);
    
    // Store for later cleanup
    this.realtimeListeners.set(listenerId, { ref, eventType, callback });
    
    return () => {
      ref.off(eventType, callback);
      this.realtimeListeners.delete(listenerId);
    };
  }
  
  /**
   * Remove all active listeners
   * Interview Question: When and why would you need to remove listeners?
   */
  public removeAllListeners(): void {
    // Clear Firestore listeners
    this.firestoreListeners.forEach(unsubscribe => {
      unsubscribe();
    });
    this.firestoreListeners.clear();
    
    // Clear Realtime DB listeners
    this.realtimeListeners.forEach(({ ref, eventType, callback }) => {
      ref.off(eventType, callback);
    });
    this.realtimeListeners.clear();
    
    console.log('All Firebase listeners removed');
  }
  
  /**
   * Check if Firebase has been initialized
   * @throws Error if Firebase is not initialized
   */
  private checkInitialization(): void {
    if (!this.isInitialized || !this.app) {
      throw new Error('Firebase has not been initialized. Call initialize() first.');
    }
  }
  
  // Mock implementation helpers
  private createMockFirestoreCollection(path: string): FirestoreCollection {
    return {
      doc: (id = Math.random().toString(36).substr(2, 9)) => this.createMockFirestoreDocumentRef(`${path}/${id}`),
      add: async (data) => {
        const id = Math.random().toString(36).substr(2, 9);
        console.log(`Adding document to ${path} with ID ${id}`, data);
        return this.createMockFirestoreDocumentRef(`${path}/${id}`);
      },
      where: (field, operator, value) => this.createMockFirestoreQuery(path),
      orderBy: (field, direction = 'asc') => this.createMockFirestoreQuery(path),
      limit: (limit) => this.createMockFirestoreQuery(path)
    };
  }
  
  private createMockFirestoreDocumentRef(path: string): FirestoreDocumentReference {
    const id = path.split('/').pop() || '';
    return {
      id,
      get: async () => {
        console.log(`Getting document at ${path}`);
        return {
          id,
          exists: true,
          data: () => ({ mockData: 'value', path })
        };
      },
      set: async (data, options) => {
        console.log(`Setting document at ${path}`, data, options);
      },
      update: async (data) => {
        console.log(`Updating document at ${path}`, data);
      },
      delete: async () => {
        console.log(`Deleting document at ${path}`);
      },
      onSnapshot: (callback) => {
        console.log(`Adding listener to document at ${path}`);
        const mockDoc = {
          id,
          exists: true,
          data: () => ({ mockData: 'value', path, timestamp: Date.now() })
        };
        // Simulate initial callback
        setTimeout(() => callback(mockDoc), 0);
        
        // Return unsubscribe function
        return () => {
          console.log(`Removing listener from document at ${path}`);
        };
      }
    };
  }
  
  private createMockFirestoreQuery(path: string): FirestoreQuery {
    return {
      where: (field, operator, value) => this.createMockFirestoreQuery(path),
      orderBy: (field, direction) => this.createMockFirestoreQuery(path),
      limit: (limit) => this.createMockFirestoreQuery(path),
      startAfter: (doc) => this.createMockFirestoreQuery(path),
      get: async () => {
        console.log(`Executing query on ${path}`);
        return {
          docs: [
            {
              id: 'doc1',
              exists: true,
              data: () => ({ mockData: 'value1' })
            },
            {
              id: 'doc2',
              exists: true,
              data: () => ({ mockData: 'value2' })
            }
          ],
          empty: false,
          size: 2
        };
      },
      onSnapshot: (callback) => {
        console.log(`Adding listener to query on ${path}`);
        const mockSnapshot = {
          docs: [
            {
              id: 'doc1',
              exists: true,
              data: () => ({ mockData: 'value1' })
            },
            {
              id: 'doc2',
              exists: true,
              data: () => ({ mockData: 'value2' })
            }
          ],
          empty: false,
          size: 2
        };
        // Simulate initial callback
        setTimeout(() => callback(mockSnapshot), 0);
        
        // Return unsubscribe function
        return () => {
          console.log(`Removing listener from query on ${path}`);
        };
      }
    };
  }
  
  private createMockRealtimeDBReference(path: string): RealtimeDBReference {
    return {
      set: async (value) => {
        console.log(`Setting value at ${path}`, value);
      },
      update: async (values) => {
        console.log(`Updating values at ${path}`, values);
      },
      remove: async () => {
        console.log(`Removing data at ${path}`);
      },
      push: () => {
        const newId = Math.random().toString(36).substr(2, 9);
        return this.createMockRealtimeDBReference(`${path}/${newId}`);
      },
      once: async (eventType) => {
        console.log(`Getting ${eventType} at ${path}`);
        return {
          val: () => ({ mockData: 'value', path }),
          exists: () => true,
          key: path.split('/').pop(),
          ref: path
        };
      },
      on: (eventType, callback) => {
        console.log(`Adding ${eventType} listener at ${path}`);
        const mockSnapshot = {
          val: () => ({ mockData: 'value', path, timestamp: Date.now() }),
          exists: () => true,
          key: path.split('/').pop(),
          ref: path
        };
        // Simulate initial callback
        setTimeout(() => callback(mockSnapshot), 0);
      },
      off: (eventType, callback) => {
        console.log(`Removing ${eventType || 'all'} listener(s) at ${path}`);
      }
    };
  }
}

export default FirebaseService;

// --- Example: Custom Hooks for Firebase ---

/**
 * Hook for Firestore document data
 * @param path Document path
 * @returns Document data, loading state, and error
 * Interview Question: How would you design React hooks for Firebase?
 */
export function useFirestoreDocument(path: string) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const firebase = FirebaseService.getInstance();
      const [collectionPath, docId] = path.split('/').filter(Boolean).reduce((result, segment, index, array) => {
        if (index % 2 === 0) {
          result[0] += (result[0] ? '/' : '') + segment;
        } else {
          result[1] = segment;
        }
        return result;
      }, ['', '']);
      
      const docRef = firebase.firestore(collectionPath).doc(docId);
      
      const unsubscribe = firebase.addDocumentListener(docRef, (doc) => {
        setLoading(false);
        if (doc.exists) {
          setData({ id: doc.id, ...doc.data() });
        } else {
          setData(null);
        }
      }, `hook_${path}`);
      
      return () => {
        unsubscribe();
      };
    } catch (err: any) {
      setError(err);
      setLoading(false);
    }
  }, [path]);
  
  return { data, loading, error };
}

/**
 * Hook for Firestore collection data
 * @param path Collection path
 * @param queryFn Function to modify the query (optional)
 * @returns Collection data, loading state, and error
 */
export function useFirestoreCollection(path: string, queryFn?: (query: any) => any) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const firebase = FirebaseService.getInstance();
      let query = firebase.firestore(path);
      
      if (queryFn) {
        query = queryFn(query);
      }
      
      const unsubscribe = firebase.addQueryListener(query as any, (docs) => {
        setLoading(false);
        setData(docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, `hook_${path}`);
      
      return () => {
        unsubscribe();
      };
    } catch (err: any) {
      setError(err);
      setLoading(false);
    }
  }, [path, queryFn]);
  
  return { data, loading, error };
}

// --- Example Usage ---
/*
import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import FirebaseService, { useFirestoreCollection, useFirestoreDocument } from './FirebaseService';

// Initialize Firebase
const initializeFirebase = () => {
  const firebase = FirebaseService.getInstance();
  firebase.initialize({
    apiKey: "YOUR_API_KEY",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-app",
    storageBucket: "your-app.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456",
    databaseURL: "https://your-app.firebaseio.com"
  });
  
  return firebase;
};

// Component using hooks
const UserProfile = ({ userId }) => {
  const { data: user, loading, error } = useFirestoreDocument(`users/${userId}`);
  
  if (loading) return <Text>Loading user...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;
  if (!user) return <Text>User not found</Text>;
  
  return (
    <View>
      <Text>Name: {user.name}</Text>
      <Text>Email: {user.email}</Text>
    </View>
  );
};

// Component using direct service
const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  useEffect(() => {
    const firebase = FirebaseService.getInstance();
    const tasksRef = firebase.firestore('tasks');
    
    const query = tasksRef.where('userId', '==', firebase.getCurrentUser()?.uid || 'anonymous')
      .orderBy('createdAt', 'desc');
    
    const unsubscribe = firebase.addQueryListener(query, (docs) => {
      setTasks(docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    const firebase = FirebaseService.getInstance();
    await firebase.firestore('tasks').add({
      title: newTaskTitle,
      completed: false,
      userId: firebase.getCurrentUser()?.uid || 'anonymous',
      createdAt: new Date().toISOString()
    });
    
    setNewTaskTitle('');
  };
  
  const toggleTaskCompletion = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const firebase = FirebaseService.getInstance();
    await firebase.firestore('tasks').doc(taskId).update({
      completed: !task.completed
    });
  };
  
  return (
    <View>
      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View>
            <Text>{item.title}</Text>
            <Button 
              title={item.completed ? "Mark Incomplete" : "Mark Complete"} 
              onPress={() => toggleTaskCompletion(item.id)} 
            />
          </View>
        )}
      />
      
      <TextInput
        value={newTaskTitle}
        onChangeText={setNewTaskTitle}
        placeholder="New task..."
      />
      <Button title="Add Task" onPress={addTask} />
    </View>
  );
};
*/