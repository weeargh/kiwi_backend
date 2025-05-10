// Single API client module for the entire application
import axios from 'axios';
import { auth0 } from '../main';

// Always use localhost:3001 for backend API consistency
const API_BASE_URL = 'http://localhost:3001/api';

// Create a new axios instance with custom config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000,
});

// Add a request interceptor to attach the auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // Check if Auth0 is initialized
      if (!auth0) {
        console.warn('Auth0 is not initialized');
        return config; 
      }

      // Check if user is authenticated
      if (!auth0.isAuthenticated?.value) {
        console.warn('User is not authenticated - endpoints requiring auth will fail');
        return config;
      }

      // Get the access token
      try {
        // Use the correct audience value - 'your-auth0-audience' is what the backend expects
        const audience = import.meta.env.VITE_AUTH0_AUDIENCE || 'your-auth0-audience';
        console.log(`Requesting token with audience: ${audience} for ${config.url}`);
        
        const token = await auth0.getAccessTokenSilently({
          audience: audience,
        });
        
        if (!token) {
          console.warn('Received empty token from Auth0');
          return config;
        }
        
        // Attach the token to the request
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`Auth token attached to request: ${config.url}`);
      } catch (tokenError) {
        // Log authentication errors but don't block the request
        console.error('Error getting access token:', tokenError);
        
        if (tokenError.message?.includes('login_required')) {
          console.warn('Login required. User session may have expired.');
          // Uncomment to auto-redirect to login
          // window.location.href = '/login';
        }
      }
      
      return config;
    } catch (error) {
      // Handle unexpected errors in the interceptor
      console.error('Unexpected error in request interceptor:', error);
      return config; 
    }
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors consistently
apiClient.interceptors.response.use(
  (response) => {
    // Check for the API's success envelope format
    if (response.data && typeof response.data === 'object') {
      if (response.data.success === false && response.data.error) {
        console.error('API Error in response:', response.data.error);
        return Promise.reject({
          status: response.status,
          data: response.data,
          message: response.data.error.message || 'API returned error'
        });
      }
      
      // For success responses with our standard envelope, return the data directly
      if (response.data.success === true && response.data.data !== undefined) {
        console.debug(`API Success: ${response.config.url}`);
        return response.data.data;
      }
    }
    
    // Return the response as is for other successful requests
    return response;
  },
  (error) => {
    // If there's a specific error status to handle
    if (error.response) {
      const requestUrl = error.config?.url || 'unknown URL';
      const requestMethod = error.config?.method?.toUpperCase() || 'unknown method';
      
      // Handle authentication issues
      if (error.response.status === 401) {
        console.warn(`Authentication error (401): ${requestMethod} ${requestUrl}`, error.response.data);
        
        // Force re-authentication if needed
        if (auth0 && auth0.isAuthenticated?.value) {
          console.warn('Token appears invalid. User may need to re-login.');
          // Uncomment to auto-logout
          // auth0.logout({ returnTo: window.location.origin });
        }
      } else if (error.response.status === 403) {
        console.warn(`Authorization error (403): ${requestMethod} ${requestUrl}`, error.response.data);
      } else {
        console.error(`API Error (${error.response.status}): ${requestMethod} ${requestUrl}`, error.response.data);
      }
      
      return Promise.reject(error.response);
    }
    
    // For network errors or other issues
    console.error('API Error (network):', error.message || error);
    return Promise.reject({ 
      status: 0, 
      message: 'Network error or request cancelled',
      originalError: error
    });
  }
);

export default apiClient; 