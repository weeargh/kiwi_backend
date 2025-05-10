import axios from 'axios';
// import { useAuth0 } from '@auth0/auth0-vue';
import { auth0 } from '../main'; // Import the auth0 instance from main.js

// Update to consistently use port 3001 for the backend API
// Use environment variable for backend API URL; fallback is for local dev only
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ? (import.meta.env.VITE_API_BASE_URL + '/api') : 'http://localhost:3001/api';

// Create an Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Axios request interceptor to automatically add the Auth0 Access Token.
 */
apiClient.interceptors.request.use(async (config) => {
  try {
    // Check if Auth0 is initialized and user is authenticated
    if (!auth0) {
      console.warn('Auth0 instance is not available in apiClient');
      return config;
    }
    
    if (!auth0.isAuthenticated.value) {
      console.warn('User is not authenticated in apiClient');
      return config;
    }
    
    if (!auth0.getAccessTokenSilently) {
      console.error('Auth0 getAccessTokenSilently method is not available');
      return config;
    }

    try {
      // Get the token silently with explicit audience parameter
      const audience = import.meta.env.VITE_AUTH0_AUDIENCE || 'your-auth0-audience';
      console.log('Requesting token with audience:', audience);
      
      const token = await auth0.getAccessTokenSilently({
        audience: audience,
      });
      
      if (!token) {
        console.warn('Received empty token from Auth0');
        return config;
      }
      
      // Add the Authorization header
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Auth token attached to request:', config.url);
    } catch (tokenError) {
      console.error('Failed to get access token:', tokenError);
      // If user is logged out, suggest login
      if (tokenError.message?.includes('login_required')) {
        console.warn('Login required. User session may have expired.');
        // Optional: Redirect to login page
        // window.location.href = '/login';
      }
    }

    return config;
  } catch (error) {
    // Handle unexpected errors in the interceptor
    console.error('Unexpected error in request interceptor:', error);
    return config; // Continue with the request
  }
}, (error) => {
  // Handle request configuration errors
  console.error('Axios request config error:', error);
  return Promise.reject(error);
});

/**
 * Axios response interceptor for handling common API responses/errors.
 */
apiClient.interceptors.response.use(
  (response) => {
    // If the response looks like our standard success format, return the data part
    if (response.data && response.data.success === true && response.data.data !== undefined) {
      console.debug(`API Success Response - Path: ${response.config.url}`, response.data.data);
      return response.data.data;
    } 
    // Otherwise, return the full response
    return response;
  },
  (error) => {
    // Handle API errors globally
    console.error(`API Error Response - Path: ${error.config?.url}`, error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.warn('Authentication error. User may need to log in again.');
      // Optional: Redirect to login page
      // window.location.href = '/login';
    }

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const apiError = error.response.data?.error || {
        code: `HTTP_${error.response.status}`,
        message: error.response.statusText,
      };
      // Optionally, you can trigger global error notifications here
      // e.g., useToast().add({ severity: 'error', summary: `API Error (${apiError.code})`, detail: apiError.message, life: 5000 });
      return Promise.reject({ ...apiError, status: error.response.status }); // Reject with a structured error
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error: No response received', error.request);
      return Promise.reject({ code: 'NETWORK_ERROR', message: 'Could not connect to the server.' });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error: Request setup failed', error.message);
      return Promise.reject({ code: 'REQUEST_SETUP_ERROR', message: error.message });
    }
  }
);

export default apiClient; 