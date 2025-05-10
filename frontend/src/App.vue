<script setup>
import { computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { ElButton, ElLoading, ElNotification, ElMessageBox, ElContainer, ElHeader, ElAside, ElMain, ElFooter } from 'element-plus';
import { Menu as IconMenu, Loading } from '@element-plus/icons-vue'; // User, ChartPie, DataAnalysis, Money, Setting, List, Box, Document are now in Sidebar.vue
import { useRouter } from 'vue-router'; // Import useRouter
import Sidebar from './components/Sidebar.vue'; // Import the new Sidebar component

const { loginWithRedirect, logout, user, isAuthenticated, isLoading, idTokenClaims } = useAuth0();
const router = useRouter(); // Get router instance

// Determine if the user is an admin based on custom role claim
const roleClaim = 'https://api.domain.com/roles'; // Adjust claim name if different!
const isAdmin = computed(() => {
  if (isAuthenticated.value && idTokenClaims.value) {
    const roles = idTokenClaims.value[roleClaim];
    return Array.isArray(roles) && roles.includes('admin');
  }
  return false;
});

const handleLogin = () => {
  loginWithRedirect({
    appState: {
      target: '/', // Redirect back to the root after login
    },
  });
};

const handleLogout = () => {
  logout({ logoutParams: { returnTo: window.location.origin } });
};

// Helper functions for notifications
const showNotification = (message, type = 'success') => {
  ElNotification({
    title: type.charAt(0).toUpperCase() + type.slice(1),
    message,
    type,
    duration: 3000
  });
};

// Helper for confirmation dialog
const confirmAction = (message, title, callback) => {
  ElMessageBox.confirm(message, title, {
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    type: 'warning',
  }).then(() => {
    callback();
  }).catch(() => {
    // Cancelled
  });
};

</script>

<template>
  <el-container class="app-layout-container-vertical">
    <!-- Header -->
    <el-header class="app-header">
      <div class="header-left">
        <h1>Kiwi3 RSU Platform</h1>
      </div>
      <div v-if="isAuthenticated" class="user-info">
        <span>Welcome, {{ user.name || user.email }} <span v-if="isAdmin" class="user-role">(Admin)</span><span v-else class="user-role">(Employee)</span></span>
        <el-button @click="handleLogout" text>Log Out</el-button>
      </div>
      <div v-else>
        <el-button @click="handleLogin" type="primary">Log In</el-button>
      </div>
    </el-header>

    <el-container class="main-body-container">
      <Sidebar v-if="isAuthenticated" />
      <el-container class="page-content-wrapper">
        <!-- Main Content Area -->
        <el-main class="app-main">
          <div v-if="isLoading" class="loading-container">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
            <p>Loading...</p>
          </div>
          <div v-else-if="!isAuthenticated && $route.meta.requiresAuth" class="login-container">
            <div class="login-box">
              <h2>Authentication Required</h2>
              <p>Please log in to access this page.</p>
              <el-button @click="handleLogin" type="primary" size="large">Log In</el-button>
            </div>
          </div>
          <router-view v-else />
        </el-main>

        <!-- Footer stays at the bottom -->
        <el-footer class="app-footer">
          <small>Kiwi3 RSU Platform &copy; 2025</small>
        </el-footer>
      </el-container>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-layout-container-vertical {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-body-container {
  display: flex;
  flex-grow: 1;
  overflow: hidden; /* To contain sidebar and scrolling main content */
}

.page-content-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow-y: auto; /* Allows main content + footer to scroll */
}

.app-header {
  background-color: white;
  padding: 0 1.5rem; /* Adjusted padding, height will be set */
  height: 60px; /* Fixed header height */
  line-height: 60px; /* Vertically center content in header */
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0; /* Prevent header from shrinking */
  z-index: 10; /* Ensure header appears above sidebar */
}

.app-header .el-button.is-text {
  background-color: transparent;
  border: none;
}

.app-header .el-button--primary {
  background-color: var(--el-color-primary);
  border-color: var(--el-color-primary);
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-left h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--el-color-primary);
  font-weight: 600;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-info span {
  margin-right: 1rem;
  color: #606266;
}

.user-role {
  font-weight: 600;
  color: var(--el-color-primary);
}

.app-main {
  flex-grow: 1;
  padding: 1.5rem; /* Consistent padding */
  background-color: #f0f2f5; /* Background for the main content area */
}

.loading-container, .login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  height: 100%; /* Make it take full height of el-main if possible */
}

.login-box {
  padding: 2rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.login-box h2 {
  color: var(--el-color-primary);
  margin-top: 0;
}

.loading-container .el-icon {
  margin-bottom: 1rem;
  color: var(--el-color-primary);
}

.app-footer {
  background-color: white;
  padding: 1rem;
  text-align: center;
  color: var(--el-text-color-secondary);
  border-top: 1px solid #e0e0e0; /* Added border for separation */
}
</style>
