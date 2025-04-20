/**
 * @file RestApiService.ts
 * Provides methods for interacting with a RESTful API.
 * Uses the built-in Fetch API, but could be adapted for libraries like Axios.
 *
 * --- DETAILED INTERVIEW QUESTIONS ---
 *
 * **Core Concepts & HTTP:**
 * - Explain the fundamental principles of REST (Representational State Transfer). What are the key constraints (Stateless, Cacheable, Client-Server, Uniform Interface, Layered System, Code on Demand [optional])?
 * - Describe the common HTTP methods (GET, POST, PUT, DELETE, PATCH). When should each be used? What are idempotency and safety in the context of these methods?
 * - What are HTTP status codes? Give examples of codes in different ranges (1xx, 2xx, 3xx, 4xx, 5xx) and explain their general meaning (e.g., 200, 201, 400, 401, 403, 404, 500).
 * - Explain the structure of an HTTP request and response (Headers, Body, Status Line/Code). What are common headers (e.g., `Content-Type`, `Authorization`, `Accept`, `Cache-Control`) and their purpose?
 * - What is the difference between `PUT` and `PATCH`?
 * - How does REST handle state? (It's stateless - each request contains all necessary info).
 *
 * **Implementation & React Native:**
 * - Compare using the native `fetch` API versus libraries like `axios`. What are the pros and cons of each in a React Native context? (Axios: interceptors, automatic JSON parsing, better error handling, timeout config, cancellation; Fetch: built-in, Promise-based).
 * - How would you handle API base URLs and environment configuration (development, staging, production)? (Using config files, environment variables via tools like `react-native-config`).
 * - Explain how you would implement request/response interceptors (e.g., for adding auth tokens automatically or handling global errors). How is this typically done with `fetch` vs. `axios`?
 * - How do you handle network errors (e.g., no internet connection, DNS issues) versus API errors (e.g., 4xx, 5xx)? Implement robust error handling.
 * - Discuss strategies for handling loading states and displaying feedback to the user during API calls. (State variables, spinners, disabling buttons).
 * - How would you implement request cancellation? Why is it important? (Using `AbortController` with `fetch`, or cancel tokens with `axios`).
 * - Explain how you would handle authentication (e.g., JWT tokens, API keys). Where should tokens be stored securely in React Native? (`AsyncStorage` is generally *not* secure for sensitive data; use secure storage like `react-native-keychain`). How would you refresh tokens?
 * - How can you optimize API calls? Discuss caching strategies (HTTP caching headers, local caching with AsyncStorage/state management, libraries like React Query/SWR).
 * - How do you handle different content types (JSON, FormData for file uploads)?
 * - How would you structure your API service/layer in a larger React Native application? (Separate service files, hooks, integration with state management).
 * - How do you handle API versioning?
 * - What are potential security concerns when making API calls from a mobile app? (Man-in-the-middle attacks - use HTTPS, secure token storage, input validation).
 * - How would you mock API calls for testing (unit/integration tests)? (Using libraries like `jest.mock`, `msw` - Mock Service Worker).
 *
 * **Advanced:**
 * - What is HATEOAS (Hypermedia as the Engine of Application State)? How does it relate to REST?
 * - Discuss rate limiting and how a client application should handle it (e.g., respecting `Retry-After` headers).
 * - How would you implement background data fetching or synchronization? (Using background tasks/services, libraries like `react-native-background-fetch`).
 */

import { Platform } from 'react-native'; // Example import

// Consider using a configuration file for the base URL
const API_BASE_URL = 'https://api.example.com/v1'; // Replace with your actual API base URL

interface RequestOptions extends RequestInit {
  params?: Record<string, string>; // For query parameters
  // Add other custom options if needed
}

export class RestApiService {
  /**
   * Performs a GET request.
   * @param endpoint - The API endpoint (e.g., '/users').
   * @param options - Optional request options including query parameters.
   * @returns Promise<T> - A promise resolving to the parsed JSON response.
   * Interview Question: How would you add support for query parameters in a clean way?
   * Interview Question: How would you handle non-JSON responses?
   */
  static async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.params);
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Performs a POST request.
   * @param endpoint - The API endpoint.
   * @param body - The request body (usually an object, will be stringified).
   * @param options - Optional request options.
   * @returns Promise<T> - A promise resolving to the parsed JSON response.
   * Interview Question: Why is `JSON.stringify` necessary here? What header is crucial? (`Content-Type: application/json`)
   */
  static async post<T>(endpoint: string, body: any, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint);
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Performs a PUT request.
   * @param endpoint - The API endpoint (e.g., '/users/123').
   * @param body - The request body.
   * @param options - Optional request options.
   * @returns Promise<T> - A promise resolving to the parsed JSON response.
   */
  static async put<T>(endpoint: string, body: any, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint);
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Performs a DELETE request.
   * @param endpoint - The API endpoint (e.g., '/users/123').
   * @param options - Optional request options.
   * @returns Promise<T> - A promise resolving to the parsed JSON response (often empty or a confirmation).
   */
  static async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint);
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * Performs a PATCH request.
   * @param endpoint - The API endpoint (e.g., '/users/123').
   * @param body - The partial data to update.
   * @param options - Optional request options.
   * @returns Promise<T> - A promise resolving to the parsed JSON response.
   */
  static async patch<T>(endpoint: string, body: any, options: RequestOptions = {}): Promise<T> {
      const url = this.buildUrl(endpoint);
      return this.request<T>(url, {
          ...options,
          method: 'PATCH',
          headers: {
              'Content-Type': 'application/json',
              ...options.headers,
          },
          body: JSON.stringify(body),
      });
  }

  // --- Helper Methods ---

  /**
   * Builds the full URL including query parameters.
   * @param endpoint - The specific endpoint path.
   * @param params - Optional query parameters object.
   * @returns The full URL string.
   */
  private static buildUrl(endpoint: string, params?: Record<string, string>): string {
    let url = `${API_BASE_URL}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams(params).toString();
      if (queryParams) {
        url += `?${queryParams}`;
      }
    }
    return url;
  }

  /**
   * Centralized request logic using Fetch API.
   * @param url - The full URL to request.
   * @param options - RequestInit options for fetch.
   * @returns Promise<T> - A promise resolving to the parsed JSON response.
   * Interview Question: Implement robust error handling here. What different types of errors can occur? (Network errors, HTTP errors 4xx/5xx, JSON parsing errors).
   * Interview Question: How would you add an `Authorization` header (e.g., Bearer token) to every request? (Interceptor pattern or add here).
   * Interview Question: How would you implement request timeouts using `AbortController`?
   */
  private static async request<T>(url: string, options: RequestInit): Promise<T> {
    console.log(`[API Request] ${options.method || 'GET'} ${url}`); // Basic logging

    // Example: Add default headers
    const defaultHeaders = {
      'Accept': 'application/json',
      'X-Platform': Platform.OS, // Example custom header
      // Add other default headers like API keys if needed
    };

    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      // Example: Add timeout using AbortController
      // signal: AbortSignal.timeout(15000) // 15 seconds timeout (requires newer JS environment or polyfill)
    };

    try {
      const response = await fetch(url, mergedOptions);

      // Check for HTTP errors (4xx, 5xx)
      if (!response.ok) {
        // Attempt to parse error body for more details
        let errorBody;
        try {
          errorBody = await response.json();
        } catch (e) {
          // Ignore if error body is not JSON or empty
          errorBody = await response.text(); // Fallback to text
        }
        console.error(`[API Error] ${response.status} ${response.statusText} on ${url}`, errorBody);
        // Throw a custom error object for better handling upstream
        throw new ApiError(response.status, response.statusText, errorBody);
      }

      // Handle successful responses
      // Handle cases with no content (e.g., 204 No Content)
      if (response.status === 204) {
        console.log(`[API Response] ${response.status} ${response.statusText} on ${url}`);
        // Return null or an appropriate value for no content
        return null as T;
      }

      // Parse JSON response
      const data: T = await response.json();
      console.log(`[API Response] ${response.status} on ${url}`); // Avoid logging data itself unless debugging
      return data;

    } catch (error) {
      // Handle network errors, JSON parsing errors, or the ApiError thrown above
      if (error instanceof ApiError) {
        // Re-throw the structured API error
        throw error;
      } else if (error instanceof SyntaxError) {
        // Handle JSON parsing errors
        console.error(`[API Error] Failed to parse JSON response from ${url}`, error);
        throw new Error(`Invalid JSON received from server.`);
      } else if (error instanceof TypeError && error.message.includes('Network request failed')) {
         // Handle network errors (e.g., no connection)
         console.error(`[API Error] Network request failed for ${url}`, error);
         throw new Error('Network request failed. Please check your connection.');
      } else {
        // Handle other unexpected errors (e.g., AbortError for timeouts)
        console.error(`[API Error] Unexpected error during request to ${url}`, error);
        throw new Error('An unexpected error occurred during the API request.');
      }
    }
  }
}

/**
 * Custom error class for API errors.
 * Interview Question: Why create a custom error class? (Allows specific catching and handling of API vs other errors, carries status code).
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: any // The parsed error body from the API, if available
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
    // Maintains proper stack trace in V8 environments (Node, Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

// --- Example Usage (in a component or another service) ---
/*
import { RestApiService, ApiError } from './RestApiService';

interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUsers() {
  try {
    const users = await RestApiService.get<User[]>('/users');
    console.log('Fetched Users:', users);
    // Update state with users
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error ${error.status}: ${error.message}`, error.body);
      // Handle specific statuses
      if (error.status === 401) {
        // Handle unauthorized, e.g., redirect to login
      } else {
        // Show generic API error message
      }
    } else {
      console.error('Network or other error:', error.message);
      // Show generic network error message
    }
  }
}

async function createUser(name: string, email: string) {
  try {
    const newUser = await RestApiService.post<User>('/users', { name, email });
    console.log('Created User:', newUser);
    // Update state or refetch list
  } catch (error) {
     // ... error handling as above ...
  }
}
*/
