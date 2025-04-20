/**
 * @file GraphQLService.ts
 * A service for GraphQL API interactions using Apollo Client.
 * Demonstrates how to set up and use GraphQL in a React Native app.
 * 
 * --- DETAILED INTERVIEW QUESTIONS ---
 *
 * **Core GraphQL Concepts:**
 * - What is GraphQL and how does it differ from REST? (Single endpoint, client-specified data, strong typing, introspection, etc.)
 * - Explain the main components of a GraphQL schema (types, queries, mutations, subscriptions).
 * - What are the benefits of GraphQL over REST? What are the trade-offs? (Benefits: No over/under fetching, strongly typed, single request for multiple resources. Trade-offs: Caching complexity, potential performance issues with complex queries, learning curve)
 * - Explain how GraphQL resolvers work. How is a GraphQL request processed on the server?
 * - What is GraphQL introspection? How is it useful during development?
 * - How does GraphQL handle errors? Explain the difference between GraphQL errors and HTTP errors.
 * 
 * **GraphQL Client Implementation:**
 * - Compare popular GraphQL clients (Apollo Client, Relay, urql). What are their strengths and weaknesses?
 * - How does Apollo Client manage the local cache? Explain cache normalization and cache policies.
 * - How would you handle authentication in a GraphQL API? (Using HTTP headers, context, directives)
 * - What are GraphQL fragments and how do they help with code reusability?
 * - How do you optimize GraphQL queries? (Pagination, proper selection sets, avoiding N+1 problems)
 * - Explain how batching and query deduplication work in Apollo Client.
 * - What strategies would you use to debug GraphQL queries? (Apollo DevTools, logging, Network inspection)
 * 
 * **GraphQL in React Native:**
 * - How would you structure a GraphQL project in a React Native application?
 * - What are the considerations for offline support with GraphQL in mobile apps?
 * - How do you handle file uploads with GraphQL in React Native?
 * - Explain optimistic UI updates with GraphQL mutations. How do they improve user experience?
 * - How would you implement real-time features using GraphQL subscriptions in React Native?
 * - How would you handle GraphQL error states in the UI? (Error boundaries, Apollo error policies)
 * 
 * **Advanced GraphQL:**
 * - What are GraphQL directives and how can they be used? (@include, @skip, @deprecated, custom directives)
 * - How do you handle data pagination in GraphQL? Compare offset-based, cursor-based, and relay-style pagination.
 * - What are the security concerns with GraphQL? (Query complexity, rate limiting, depth limiting)
 * - How would you implement authorization in GraphQL? (Field-level, type-level, directive-based)
 * - Explain the differences between Apollo Client's `useQuery`, `useLazyQuery`, and `useQuery` with `skip`.
 * - How would you implement client-side schema validation for GraphQL?
 * - What are persisted queries and how do they improve GraphQL performance?
 * - How would you handle file uploads with GraphQL in React Native?
 */

import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, from, Observable, NormalizedCacheObject } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { setContext } from '@apollo/client/link/context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Example of type for auth state
interface AuthState {
  token: string | null;
}

class GraphQLService {
  private static instance: GraphQLService;
  private client: ApolloClient<NormalizedCacheObject>;

  private constructor() {
    // Set up Apollo Client
    this.client = this.setupApolloClient();
  }

  /**
   * Get the singleton instance of GraphQLService
   * Interview Question: Why use a singleton pattern here? What are the pros and cons?
   */
  public static getInstance(): GraphQLService {
    if (!GraphQLService.instance) {
      GraphQLService.instance = new GraphQLService();
    }
    return GraphQLService.instance;
  }
  
  /**
   * Get the Apollo Client instance
   */
  public getClient(): ApolloClient<NormalizedCacheObject> {
    return this.client;
  }

  /**
   * Reset the Apollo Client's store (useful after logout)
   * Interview Question: When would you need to reset the Apollo store?
   */
  public async resetStore(): Promise<void> {
    return this.client.resetStore();
  }

  /**
   * Setup the Apollo Client with all necessary links
   * Interview Question: Explain the Apollo Link chain concept and how the order matters
   */
  private setupApolloClient(): ApolloClient<NormalizedCacheObject> {
    // Create the HTTP link that connects to your GraphQL API
    const httpLink = new HttpLink({
      uri: 'https://api.example.com/graphql', // Replace with your GraphQL endpoint
    });
    
    // Retry link for automatic retries on network failures
    const retryLink = new RetryLink({
      delay: {
        initial: 300,
        max: 3000,
        jitter: true
      },
      attempts: {
        max: 3,
        retryIf: (error) => !!error && error.statusCode !== 401 && error.statusCode !== 403
      }
    });
    
    // Error handling link
    const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
      if (graphQLErrors) {
        graphQLErrors.forEach(({ message, locations, path }) => 
          console.error(
            `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
          )
        );

        // Example of error handling for specific errors
        for (let err of graphQLErrors) {
          // Handle specific error codes
          if (err.extensions?.code === 'UNAUTHENTICATED') {
            // Handle auth errors - eg. redirect to login or refresh token
            return this.handleAuthError(operation, forward);
          }
        }
      }
      
      if (networkError) {
        console.error(`[Network error]: ${networkError}`);
        // Handle network errors (e.g., show offline notification)
      }
    });
    
    // Authentication link for adding auth headers
    const authLink = setContext(async (_, { headers }) => {
      // Get the authentication token from storage if it exists
      const token = await this.getAuthToken();
      
      // Return the headers to the context so httpLink can read them
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : "",
          // You can add other headers as needed
          'x-app-version': '1.0.0',
          'x-platform': 'react-native',
        }
      };
    });
    
    // Combine all links
    const link = from([
      errorLink,
      retryLink,
      authLink,
      httpLink
    ]);
    
    // Create the cache with options
    const cache = new InMemoryCache({
      // Type policies help with cache normalization and pagination
      typePolicies: {
        Query: {
          fields: {
            // Example of field policy for cursor-based pagination
            feed: {
              // Don't cache separate results based on pagination args
              keyArgs: ["type"],
              // Custom merge function to handle pagination
              merge(existing = { items: [], cursor: null }, incoming) {
                return {
                  items: [...(existing.items || []), ...incoming.items],
                  cursor: incoming.cursor,
                };
              },
            },
          },
        },
      },
    });
    
    // Create and return the Apollo Client
    return new ApolloClient({
      link,
      cache,
      defaultOptions: {
        watchQuery: {
          fetchPolicy: 'cache-and-network',
          errorPolicy: 'all',
        },
        query: {
          fetchPolicy: 'network-only',
          errorPolicy: 'all',
        },
        mutate: {
          errorPolicy: 'all',
        },
      },
      // Enable this for debugging
      // connectToDevTools: __DEV__,
    });
  }
  
  /**
   * Handle authentication errors - e.g., refresh tokens
   * Interview Question: Describe a complete token refresh strategy in GraphQL
   */
  private handleAuthError(operation: any, forward: any): Observable<any> {
    // Return a new observable to retry the operation after refresh
    return new Observable(observer => {
      // Implement token refresh logic here
      this.refreshAuthToken()
        .then(newToken => {
          if (newToken) {
            // Retry the operation with new token
            const subscriber = forward(operation).subscribe({
              next: observer.next.bind(observer),
              error: observer.error.bind(observer),
              complete: observer.complete.bind(observer),
            });
            return () => subscriber.unsubscribe();
          } else {
            // Token refresh failed - handle as needed (e.g., logout)
            observer.error(new Error('Auth refresh failed'));
            // Example: Redirect to login
            // navigationService.navigateToLogin();
          }
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }
  
  /**
   * Get the auth token from storage
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const authState = await AsyncStorage.getItem('authState');
      if (authState) {
        const parsedState: AuthState = JSON.parse(authState);
        return parsedState.token;
      }
      return null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }
  
  /**
   * Example token refresh implementation
   * Interview Question: How would you handle token expiration and refresh in a mobile app?
   */
  private async refreshAuthToken(): Promise<string | null> {
    try {
      // Implement your token refresh logic here
      // Example:
      // const refreshToken = await AsyncStorage.getItem('refreshToken');
      // const response = await fetch('https://api.example.com/refresh', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ refreshToken })
      // });
      // const data = await response.json();
      // if (data.token) {
      //   await AsyncStorage.setItem('authState', JSON.stringify({ token: data.token }));
      //   return data.token;
      // }
      
      // Placeholder
      return null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }
}

export default GraphQLService;

// --- Example Usage ---
/*
import { ApolloProvider, useQuery, useMutation, gql } from '@apollo/client';
import GraphQLService from './GraphQLService';

// Define example queries and mutations
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      tasks {
        id
        title
        completed
      }
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      title
      completed
    }
  }
`;

// Example provider component
export const GraphQLProvider = ({ children }) => {
  const client = GraphQLService.getInstance().getClient();
  return (
    <ApolloProvider client={client}>
      {children}
    </ApolloProvider>
  );
};

// Example component using useQuery
export const UserProfile = ({ userId }) => {
  const { loading, error, data } = useQuery(GET_USER, {
    variables: { id: userId },
    // Additional options
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
    // Skip loading if userId is not available
    skip: !userId,
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorDisplay error={error} />;
  
  return (
    <View>
      <Text>Name: {data.user.name}</Text>
      <Text>Email: {data.user.email}</Text>
      <TaskList tasks={data.user.tasks} />
    </View>
  );
};

// Example component using useMutation
export const AddTaskForm = ({ userId }) => {
  const [title, setTitle] = useState('');
  
  const [createTask, { loading, error }] = useMutation(CREATE_TASK, {
    // Optimistic response for instant UI updates
    optimisticResponse: {
      createTask: {
        __typename: 'Task',
        id: 'temp-id',
        title: title,
        completed: false
      }
    },
    // Update the cache with the new task
    update(cache, { data: { createTask } }) {
      // Read existing user data
      const userData = cache.readQuery({
        query: GET_USER,
        variables: { id: userId }
      });
      
      // Write back the updated tasks
      cache.writeQuery({
        query: GET_USER,
        variables: { id: userId },
        data: {
          user: {
            ...userData.user,
            tasks: [...userData.user.tasks, createTask]
          }
        }
      });
    },
    // Handle errors
    onError: (error) => {
      console.error('Error creating task:', error);
      // Show error toast/alert
    }
  });
  
  const handleSubmit = () => {
    if (title.trim()) {
      createTask({
        variables: {
          input: {
            userId,
            title,
            completed: false
          }
        }
      });
      setTitle('');
    }
  };
  
  return (
    <View>
      <TextInput value={title} onChangeText={setTitle} placeholder="New task..." />
      <Button title="Add Task" onPress={handleSubmit} disabled={loading} />
      {error && <Text style={{ color: 'red' }}>Error: {error.message}</Text>}
    </View>
  );
};
*/