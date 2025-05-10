import { createRouter, createWebHistory } from 'vue-router';
import { authGuard } from '@auth0/auth0-vue';
import Dashboard from './components/Dashboard.vue';
import PoolManagement from './components/PoolManagement.vue';
import PPSManagement from './components/PPSManagement.vue';
import UserManagement from './components/UserManagement.vue';
// Import placeholder components (we'll create these)
import TenantSettings from './components/TenantSettings.vue'; 
import EmployeeList from './components/EmployeeList.vue';
import GrantList from './components/GrantList.vue';
import AuditLogView from './components/AuditLogView.vue';
import UserGrants from './components/UserGrants.vue'; // Import UserGrants

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    beforeEnter: authGuard, // Protect this route
    meta: { requiresAuth: true, title: 'Dashboard' } 
  },
  {
    path: '/pool',
    name: 'Pool',
    component: PoolManagement,
    beforeEnter: authGuard,
    meta: { requiresAuth: true, title: 'Equity Pool' }
  },

  {
    path: '/users',
    name: 'Users',
    component: UserManagement,
    beforeEnter: authGuard,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'User Management' } // Add requiresAdmin meta field
  },
  {
    path: '/settings',
    name: 'Settings',
    component: TenantSettings, // Assuming Settings maps to TenantSettings
    beforeEnter: authGuard,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Settings' } // Settings likely admin-only
  },
  // --- Placeholder Routes for Future Stages ---
  {
    path: '/employees',
    name: 'Employees',
    component: EmployeeList, // Placeholder component
    beforeEnter: authGuard,
    meta: { requiresAuth: true, title: 'Employees' } // Stage 3
  },
  {
    path: '/grants',
    name: 'Grants',
    component: GrantList, // Placeholder component
    beforeEnter: authGuard,
    meta: { requiresAuth: true, title: 'Grants' } // Stage 3
  },
  {
    path: '/audit-logs',
    name: 'AuditLogs',
    component: AuditLogView,
    beforeEnter: authGuard, 
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Audit Log' }
  },
  {
    path: '/my-equity', // Path for My Equity page
    name: 'MyEquity',
    component: UserGrants,
    beforeEnter: authGuard,
    meta: { requiresAuth: true, title: 'My Equity' }
  },
  // Optional: Add a 404 Not Found route
  // { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFoundComponent }, 
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Optional: Global Navigation Guard Example (can be used instead of per-route authGuard if needed)
// router.beforeEach((to, from, next) => {
//   // Example: Check if route requires admin and user is admin
//   if (to.meta.requiresAdmin) {
//     // Here you would check the user's role (needs access to auth0 state)
//     // This logic is complex to do globally without a state management library
//     // For now, we rely on conditional rendering in App.vue for sidebar links
//     // and potentially checks within the admin components themselves.
//     console.warn('Admin check in global guard is complex, relying on component logic for now.');
//   }
//   next();
// });

export default router;
