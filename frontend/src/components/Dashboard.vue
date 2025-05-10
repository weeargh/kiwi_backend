<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>Dashboard</h1>
      
      <ErrorDisplay 
        v-if="authError" 
        severity="auth" 
        title="Authentication Required" 
        :message="authError" 
        :dismissible="false" 
      />
    </div>
    
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>Loading dashboard data...</p>
    </div>
    
    <div v-else-if="!authError" class="dashboard-content">
      <!-- Pool Statistics Card -->
      <el-card class="pool-statistics-card" v-if="formattedPoolSummary">
        <template #header>
          <div class="card-title">Equity Pool Overview</div>
        </template>
        <div class="pool-metrics">
          <div class="metric-row">
            <div class="metric">
              <label>Total Pool Shares:</label>
              <div class="value">{{ formattedPoolSummary.total_pool }}</div>
            </div>
            <div class="metric">
              <label>Available Shares:</label>
              <div class="value highlight">{{ formattedPoolSummary.available_shares }}</div>
            </div>
          </div>
          <div class="metric-row">
            <div class="metric">
              <label>Granted Shares:</label>
              <div class="value">{{ formattedPoolSummary.granted_shares }}</div>
            </div>
            <div class="metric">
              <label>Returned Shares (from inactive grants):</label>
              <div class="value">{{ formattedPoolSummary.returned_shares }}</div>
            </div>
          </div>
        </div>
      </el-card>
      <el-card v-else class="pool-statistics-card">
         <template #header>
          <div class="card-title">Equity Pool Overview</div>
        </template>
        <p>No pool data available or pool not yet initialized.</p>
      </el-card>

      <!-- Recent Activity Card (Changelog) -->
      <el-card class="activity-card">
        <template #header>
          <div class="card-title">Recent Changes</div>
        </template>
        <div v-if="activityLoading" class="loading-container">
          <el-icon class="is-loading"><Loading /></el-icon>
        </div>
        <DataTableWithLoading
          v-else
          :value="recentActivity"
          :loading="activityLoading"
          :empty-message="'No recent activity'"
          class="activity-table"
        >
          <el-table-column prop="date" label="Date">
            <template #default="{ row }">
              {{ formatDate(row.date) }}
            </template>
          </el-table-column>
          <el-table-column prop="type" label="Type">
            <template #default="{ row }">
              <el-tag :type="getActivitySeverity(row.type)">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="Description" />
          <el-table-column prop="amount" label="Amount">
            <template #default="{ row }">
              {{ formatNumber(row.amount) }} shares
            </template>
          </el-table-column>
        </DataTableWithLoading>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { ElCard, ElTableColumn, ElTag, ElNotification } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import authService from '../services/authService';
import dashboardService from '../services/dashboardService'; // For audit logs/activity
import poolService from '../services/poolService'; // For pool statistics
import ErrorDisplay from './ErrorDisplay.vue';
import DataTableWithLoading from './DataTableWithLoading.vue';
import { formatDisplayDecimal } from '../utils/dataUtils';

// Data
const loading = ref(true);
const authError = ref('');

// Pool Statistics Data
const poolSummaryData = ref(null);
const poolError = ref('');

// Activity data
const activityLoading = ref(false);
const recentActivity = ref([]);

// Computed property for formatted pool data
const formattedPoolSummary = computed(() => {
  if (!poolSummaryData.value) return null;
  return {
    total_pool: formatDisplayDecimal(poolSummaryData.value.total_pool),
    available_shares: formatDisplayDecimal(poolSummaryData.value.available_shares),
    granted_shares: formatDisplayDecimal(poolSummaryData.value.granted_shares),
    returned_shares: formatDisplayDecimal(poolSummaryData.value.returned_shares),
  };
});

// Methods
const fetchDashboardData = async () => {
  loading.value = true;
  authError.value = '';
  poolError.value = '';
  
  try {
    if (!authService.isAuthenticated()) {
      authError.value = 'You must be logged in to view your dashboard.';
      loading.value = false;
      return;
    }
    
    // Parallel fetch:
    const promises = [
      fetchPoolSummaryData(),
      fetchRecentActivity()
    ];
    await Promise.all(promises);
    
  } catch (error) {
    console.error('Error loading dashboard components:', error);
    ElNotification({
      title: 'Error',
      message: 'Failed to load dashboard data. Please try again later.',
      type: 'error',
      duration: 5000
    });
  } finally {
    loading.value = false;
  }
};

const fetchPoolSummaryData = async () => {
  try {
    const result = await poolService.getPool();
    console.log('Pool data received:', result);
    
    if (result && result.success && result.data) {
      poolSummaryData.value = result.data;
      console.log('Pool data:', poolSummaryData.value);
    } else {
      console.warn('No pool data received or invalid response:', result);
      poolSummaryData.value = null;
    }
  } catch (err) {
    console.error('Error fetching pool summary:', err);
    poolSummaryData.value = null;
  }
};

const fetchRecentActivity = async () => {
  activityLoading.value = true;
  try {
    // Get recent audit logs as activity
    const result = await dashboardService.getRecentActivity(5);
    recentActivity.value = Array.isArray(result) ? result : [];
  } catch (err) {
    console.error('Error fetching recent activity:', err);
    recentActivity.value = [];
  } finally {
    activityLoading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

const getActivitySeverity = (type) => {
  const severityMap = {
    'grant': 'success',
    'vesting': 'info',
    'termination': 'danger',
    'amendment': 'warning',
    'pool': 'primary'
  };
  return severityMap[type] || 'info';
};

onMounted(() => {
  fetchDashboardData();
});
</script>

<style scoped>
.dashboard {
  padding: 0 1rem 1rem 1rem;
}

.dashboard-header {
  margin-bottom: 1.5rem;
}

.dashboard-header h1 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.75rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.loading-container .el-icon {
  font-size: 2rem;
  color: var(--el-color-primary);
  margin-bottom: 1rem;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card-title {
  font-weight: bold;
  font-size: 1.1rem;
}

.pool-statistics-card {
  margin-bottom: 1rem;
}

.pool-metrics {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.metric {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 4px;
  background-color: var(--el-fill-color-lighter, #f5f7fa);
}

.metric label {
  display: block;
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 0.25rem;
}

.metric .value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.metric .highlight {
  color: var(--el-color-primary);
}

.activity-table {
  max-height: 300px;
  overflow-y: auto;
}

@media (min-width: 992px) {
  .dashboard-content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}
</style>
