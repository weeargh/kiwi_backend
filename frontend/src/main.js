import { createApp } from 'vue'
import { createAuth0 } from '@auth0/auth0-vue'; // Import Auth0 plugin
import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import router from './router'; // Import the router

// Element Plus CSS
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
// Import our custom theme (must be after Element Plus CSS)
import './styles/theme.css'

// Auth0 Configuration
const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;

// Validate Auth0 config from .env
if (!auth0Domain || !auth0ClientId || !auth0Audience) {
  console.error(
    'Auth0 configuration missing! Ensure VITE_AUTH0_DOMAIN, ' +
    'VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE are set in your .env file.'
  );
  // Potentially throw an error or display a message to the user
}

const app = createApp(App);

// Use Element Plus
app.use(ElementPlus)

// Register all Element Plus icons globally
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// Create the Auth0 client instance
const auth0 = createAuth0({
  domain: auth0Domain,
  clientId: auth0ClientId,
  authorizationParams: {
    redirect_uri: window.location.origin, // Use current origin for redirect
    audience: auth0Audience, // Specify the API audience
    scope: 'openid profile email' // Add OIDC scopes to ensure profile info is in token
  },
  // Optional: Configuration for refreshing tokens, if using
  // useRefreshTokens: true,
  // cacheLocation: 'localstorage', // if using refresh tokens
});

// Install the Auth0 plugin with the created instance
app.use(auth0);

// app.component('Button', Button); // Example: Register Button globally

// --- Vue Router Setup ---
app.use(router); // Use the router

app.mount('#app');

// Export the Auth0 instance for use in other modules (like apiClient.js)
export { auth0 };
