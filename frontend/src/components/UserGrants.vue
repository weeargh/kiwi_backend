<template>
  <div class="user-grants">
    <h2>My Equity Grants</h2>
    
    <ErrorDisplay 
      v-if="authError" 
      severity="auth" 
      title="Authentication Required" 
      :message="authError" 
      :dismissible="false" 
    />
    
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="30"><Loading /></el-icon>
      <p>Loading your equity grants...</p>
    </div>
    
    <div v-else-if="!authError">
      <!-- Summary card -->
      <el-card class="summary-card" style="margin-bottom: 1.5rem;">
        <template #header>
          <div class="card-header">
            <span>Equity Summary</span>
          </div>
        </template>
        <div class="summary-content">
          <div class="summary-row">
            <div class="summary-item">
              <div class="label">Total Granted Shares</div>
              <div class="value">{{ summary.totalShares || '0.000' }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Vested Shares</div>
              <div class="value">{{ summary.vestedShares || '0.000' }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Unvested Shares</div>
              <div class="value">{{ summary.unvestedShares || '0.000' }}</div>
            </div>
          </div>
          <div class="summary-row">
            <div class="summary-item">
              <div class="label">Current Share Value</div>
              <div class="value">{{ summary.currentSharePrice || '$0.000' }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Current Value (Vested)</div>
              <div class="value highlight">{{ summary.vestedValue || '$0.000' }}</div>
            </div>
            <div class="summary-item">
              <div class="label">Current Value (Total)</div>
              <div class="value">{{ summary.totalValue || '$0.000' }}</div>
            </div>
          </div>
        </div>
      </el-card>
      
      <!-- Grants table -->
      <DataTableWithLoading
        :value="grants"
        :loading="tableLoading"
        :error="error"
        title="Grant History"
        subtitle="Your equity grants and vesting schedule"
        emptyTitle="No Grants Found"
        emptyMessage="You don't have any equity grants yet."
        :totalRecords="totalGrants"
        :lazy="true" 
        @page="onPage"
        :rows="rowsPerPage" 
      >
        <el-table-column prop="grant_date" label="Grant Date" width="120">
          <template #default="scope">
            {{ formatDate(scope.row.grant_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="shares" label="Shares" width="120">
          <template #default="scope">
            {{ formatAmount(scope.row.shares) }}
          </template>
        </el-table-column>
        <el-table-column prop="grant_price" label="Grant Price" width="120">
          <template #default="scope">
            {{ formatPrice(scope.row.grant_price) }}
          </template>
        </el-table-column>
        <el-table-column prop="vesting_start_date" label="Vesting Start" width="140">
          <template #default="scope">
            {{ formatDate(scope.row.vesting_start_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="vesting_schedule" label="Vesting Schedule" width="150">
          <template #default="scope">
            {{ formatVestingSchedule(scope.row.vesting_schedule) }}
          </template>
        </el-table-column>
        <el-table-column prop="vested_shares" label="Vested Shares" width="150">
          <template #default="scope">
            {{ formatAmount(scope.row.vested_shares) }}
            <small v-if="scope.row.vested_percent">
              ({{ scope.row.vested_percent }}%)
            </small>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="Status" width="100">
          <template #default="scope">
            <el-tag :type="getStatusSeverity(scope.row.status)">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="100" fixed="right">
          <template #default="scope">
            <el-tooltip content="View Details" placement="top">
              <el-button 
                :icon="View" 
                circle 
                text
                @click="viewGrantDetails(scope.row)" 
              />
            </el-tooltip>
          </template>
        </el-table-column>
      </DataTableWithLoading>
      
      <!-- Grant details dialog -->
      <el-dialog v-model="detailsDialog" title="Grant Details" width="80%" :style="{ maxWidth: '800px' }" modal>
        <div v-if="selectedGrant" class="grant-details">
          <div class="grant-info">
            <!-- Grant Info Rows -->
            <div class="info-row">
              <div class="info-item"><span class="label">Grant ID:</span> <span class="value">{{ selectedGrant.grant_id }}</span></div>
              <div class="info-item"><span class="label">Grant Date:</span> <span class="value">{{ formatDate(selectedGrant.grant_date) }}</span></div>
              <div class="info-item"><span class="label">Shares:</span> <span class="value">{{ formatAmount(selectedGrant.shares) }}</span></div>
            </div>
            <div class="info-row">
              <div class="info-item"><span class="label">Grant Price:</span> <span class="value">{{ formatPrice(selectedGrant.grant_price) }}</span></div>
              <div class="info-item"><span class="label">Vesting Start:</span> <span class="value">{{ formatDate(selectedGrant.vesting_start_date) }}</span></div>
              <div class="info-item"><span class="label">Vesting End:</span> <span class="value">{{ formatDate(selectedGrant.vesting_end_date) }}</span></div>
            </div>
            <div class="info-row">
              <div class="info-item"><span class="label">Vested Shares:</span> <span class="value">{{ formatAmount(selectedGrant.vested_shares) }}</span></div>
              <div class="info-item"><span class="label">Unvested Shares:</span> <span class="value">{{ formatAmount(selectedGrant.unvested_shares) }}</span></div>
              <div class="info-item"><span class="label">Status:</span> <el-tag :type="getStatusSeverity(selectedGrant.status)">{{ selectedGrant.status }}</el-tag></div>
            </div>
            <div class="info-row">
              <div class="info-item full-width"><span class="label">Notes:</span> <div class="value notes">{{ selectedGrant.notes || 'No notes provided' }}</div></div>
            </div>
          </div>
          
          <h3>Vesting Schedule</h3>
          <el-table :data="selectedGrant.vesting_events || []" stripe border size="small">
            <el-table-column prop="date" label="Date" width="120">
              <template #default="scope">
                {{ formatDate(scope.row.date) }}
              </template>
            </el-table-column>
            <el-table-column prop="shares" label="Shares" width="120">
              <template #default="scope">
                {{ formatAmount(scope.row.shares) }}
              </template>
            </el-table-column>
            <el-table-column prop="cumulative_shares" label="Cumulative Shares" width="180">
              <template #default="scope">
                {{ formatAmount(scope.row.cumulative_shares) }}
              </template>
            </el-table-column>
            <el-table-column prop="cumulative_percent" label="Cumulative %" width="150">
              <template #default="scope">
                {{ scope.row.cumulative_percent }}%
              </template>
            </el-table-column>
            <el-table-column prop="status" label="Status" width="100">
              <template #default="scope">
                <el-tag :type="getStatusSeverity(scope.row.status)">{{ scope.row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <template #footer>
          <el-button @click="detailsDialog = false">Close</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { ElCard, ElTable, ElTableColumn, ElDialog, ElButton, ElTag, ElNotification, ElIcon, ElTooltip } from 'element-plus';
import { Loading, View } from '@element-plus/icons-vue';
import grantsService from '../services/grantsService';
import ppsService from '../services/ppsService';
import authService from '../services/authService';
import ErrorDisplay from './ErrorDisplay.vue';
import DataTableWithLoading from './DataTableWithLoading.vue';
import { formatDisplayDecimal, formatPrice } from '../utils/dataUtils'; // formatISODate removed

const { user } = useAuth0();

// Data for the component
const loading = ref(true);
const tableLoading = ref(false);
const grants = ref([]);
const totalGrants = ref(0);
const currentPage = ref(1); // 1-indexed for display/logic, converted for API if needed
const rowsPerPage = ref(10);
const detailsDialog = ref(false);
const selectedGrant = ref(null);
const currentPPS = ref(null);
const authError = ref('');
const error = ref(''); // For data loading errors in main table

// Summary data
const summary = ref({
  totalShares: '0.000',
  vestedShares: '0.000',
  unvestedShares: '0.000',
  currentSharePrice: '$0.000',
  vestedValue: '$0.000',
  totalValue: '$0.000'
});

// Methods
const fetchGrants = async () => {
  loading.value = true;
  authError.value = '';
  error.value = '';
  
  try {
    if (!authService.isAuthenticated()) {
      authError.value = 'You must be logged in to view your equity grants.';
      loading.value = false;
      return;
    }
    
    try {
      const ppsResult = await ppsService.getCurrentPPS();
      currentPPS.value = (ppsResult && ppsResult.price_per_share) ? ppsResult : { price_per_share: 0 };
    } catch (ppsError) {
      console.warn('Error fetching current PPS, using zero:', ppsError);
      currentPPS.value = { price_per_share: 0 };
    }
    
    // TODO: Replace placeholder summary with actual data if an endpoint becomes available
    // For now, it uses a placeholder. The spec mentions /employees/{employee_id}/grants-summary
    // but this page is for the logged-in user, not a specific employee by ID from admin view.
    // Assuming grantsService.getGrantsSummaryForCurrentUser() or similar might exist or be added.
    // If not, this summary might need to be calculated client-side from all grants, or be simplified.
    summary.value = {
      totalShares: formatDisplayDecimal(0), // Placeholder
      vestedShares: formatDisplayDecimal(0), // Placeholder
      unvestedShares: formatDisplayDecimal(0), // Placeholder
      currentSharePrice: formatPrice(currentPPS.value.price_per_share || 0),
      vestedValue: formatPrice(0), // Placeholder
      totalValue: formatPrice(0) // Placeholder
    };
    
    await fetchGrantsList();
    
  } catch (err) {
    console.error('Error fetching grants data:', err);
    if (err.status === 401 || err.status === 403) {
      authError.value = 'You do not have permission to view this data.';
    } else {
      error.value = `Failed to load equity grants: ${err.message || 'Unknown error'}`;
      ElNotification({ title: 'Error', message: error.value, type: 'error', duration: 5000 });
    }
  } finally {
    loading.value = false;
  }
};

const fetchGrantsList = async () => {
  tableLoading.value = true;
  try {
    const result = await grantsService.getGrants({
      page: currentPage.value, // Assuming grantsService expects 1-indexed page
      limit: rowsPerPage.value
    });
    
    if (result && result.data && result.data.items) {
      grants.value = result.data.items;
      totalGrants.value = result.data.pagination.total_items;
    } else if (result && result.items) { // Fallback for different API response structures
      grants.value = result.items;
      totalGrants.value = result.pagination.total_items;
    } else {
      grants.value = [];
      totalGrants.value = 0;
    }
  } catch (err) {
    console.error('Error fetching grants list:', err);
    error.value = `Failed to load grants list: ${err.message || 'Unknown error'}`;
    grants.value = []; // Reset on error
    totalGrants.value = 0;
  } finally {
    tableLoading.value = false;
  }
};

// DataTableWithLoading emits { page: 0-indexed, rows: number }
// Element Plus el-pagination's current-change emits 1-indexed page.
// DataTableWithLoading handles this translation.
const onPage = (event) => { 
  currentPage.value = event.page + 1; // Convert 0-indexed to 1-indexed for our state
  fetchGrantsList();
};

const viewGrantDetails = async (grant) => {
  try {
    const result = await grantsService.getGrantDetails(grant.grant_id);
    selectedGrant.value = result.data ? result.data : result;
    detailsDialog.value = true;
  } catch (err) {
    console.error('Error fetching grant details:', err);
    ElNotification({ title: 'Error', message: `Failed to load grant details: ${err.message}`, type: 'error', duration: 5000 });
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString();
};

const formatAmount = (amount) => {
  return formatDisplayDecimal(amount);
};

const formatVestingSchedule = (schedule) => {
  if (!schedule) return 'Standard'; // Or handle as per actual data
  const S = String(schedule);
  return S.charAt(0).toUpperCase() + S.slice(1).toLowerCase();
};

const getStatusSeverity = (status) => {
  const s = String(status).toLowerCase();
  switch (s) {
    case 'active': return 'success';
    case 'pending': return 'warning';
    case 'cancelled': return 'danger';
    case 'completed': return 'info';
    case 'vested': return 'success'; // For vesting events
    case 'unvested': return 'warning'; // For vesting events
    default: return 'info'; // Element Plus 'info' type for tags
  }
};

onMounted(() => {
  fetchGrants();
});
</script>

<style scoped>
.user-grants {
  padding: 0 1rem 1rem 1rem; /* Removed top padding */
}

.user-grants > h2 { /* Target the direct h2 child for page title styling */
  margin-top: 0;
  margin-bottom: 1.5rem; /* Space before the first card */
  font-size: 1.75rem; /* Consistent title size */
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--el-text-color-secondary);
}
.loading-container .el-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: var(--el-color-primary);
}

.summary-card {
  margin-bottom: 1.5rem;
}
.summary-card .card-header span {
  font-weight: bold;
  font-size: 1.1rem;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.summary-item {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--el-border-color-light, #ebeef5);
  border-radius: 4px;
  background-color: var(--el-fill-color-lighter, #f5f7fa);
}

.summary-item .label {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 0.25rem;
}

.summary-item .value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.summary-item .highlight {
  color: var(--el-color-primary);
}

.grant-details {
  padding: 1rem 0;
}

.grant-info {
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.info-row {
  display: flex;
  flex-wrap: wrap; /* Allow wrapping for smaller screens */
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.info-item {
  flex: 1 1 calc(33.333% - 1rem); /* Try to fit 3 items per row */
  min-width: 200px; /* Minimum width before wrapping */
}

.info-item .label {
  font-weight: bold;
  color: var(--el-text-color-secondary);
  margin-right: 0.5em;
}
.info-item .value {
   /* font-weight: normal; */
}


.info-item.full-width {
  flex-basis: 100%;
}

.info-item .notes {
  white-space: pre-wrap; /* To respect newlines in notes */
  word-break: break-word;
  margin-top: 0.25em;
}

.grant-details h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--el-border-color-light, #ebeef5);
  padding-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .summary-row {
    flex-direction: column;
    gap: 0.75rem;
  }
  .info-item {
    flex-basis: 100%; /* Stack info items on small screens */
  }
}
</style>
