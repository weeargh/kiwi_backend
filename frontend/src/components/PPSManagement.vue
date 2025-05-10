<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import ppsService from '../services/ppsService';
import { ElCard, ElButton, ElTable, ElTableColumn, ElDialog, ElInputNumber, ElDatePicker, ElNotification, ElPagination } from 'element-plus';
import { Loading, Plus, Check, Close } from '@element-plus/icons-vue';

const { user, getAccessTokenSilently } = useAuth0();

// Data for the component
const loading = ref(true);
const currentPPS = ref(null);
const ppsHistory = ref([]);
const totalPPSEntries = ref(0);
const ppsDialog = ref(false);
const newPPS = ref({
  effective_date: new Date(),
  price_per_share: null
});
const submitting = ref(false);
const currentPage = ref(1);
const rowsPerPage = ref(10);

// Computed properties
const userIsAdmin = computed(() => {
  return user.value?.['https://api.domain.com/roles']?.includes('admin');
});

const formattedCurrentPPS = computed(() => {
  if (!currentPPS.value) return 'Not set';
  
  return `$${Number(currentPPS.value.price_per_share).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
});

// Methods
const fetchPPSData = async () => {
  loading.value = true;
  try {
    // Try to get the current PPS
    try {
      const result = await ppsService.getCurrentPPS();
      currentPPS.value = result;
    } catch (error) {
      if (error.status === 404) {
        // It's ok if no PPS is set yet
        currentPPS.value = null;
      } else {
        throw error;
      }
    }
    
    // Get the PPS history with pagination
    await fetchPPSHistory();
  } catch (error) {
    console.error('Error fetching PPS data:', error);
    ElNotification({
      title: 'Error',
      message: `Failed to load PPS data: ${error.message}`,
      type: 'error',
      duration: 5000
    });
  } finally {
    loading.value = false;
  }
};

const fetchPPSHistory = async () => {
  try {
    const result = await ppsService.getPPSHistory({
      page: currentPage.value,
      limit: rowsPerPage.value
    });
    
    if (result && result.data && result.data.items) {
      ppsHistory.value = result.data.items;
      totalPPSEntries.value = result.data.pagination.total_items;
    } else if (result && result.items) {
      ppsHistory.value = result.items;
      totalPPSEntries.value = result.pagination.total_items;
    } else {
      // Initialize with empty array if no valid data structure
      console.warn('Received unexpected API response structure:', result);
      ppsHistory.value = [];
      totalPPSEntries.value = 0;
    }
  } catch (error) {
    console.error('Error fetching PPS history:', error);
    ElNotification({
      title: 'Error',
      message: `Failed to load PPS history: ${error.message}`,
      type: 'error',
      duration: 5000
    });
    // Initialize with empty array on error
    ppsHistory.value = [];
    totalPPSEntries.value = 0;
  }
};

const onPageChange = (page) => {
  currentPage.value = page;
  fetchPPSHistory();
};

const openNewPPSDialog = () => {
  newPPS.value = {
    effective_date: new Date(),
    price_per_share: null
  };
  ppsDialog.value = true;
};

const submitNewPPS = async () => {
  // Validate form inputs
  if (!newPPS.value.price_per_share || !newPPS.value.effective_date) {
    ElNotification({
      title: 'Validation Error',
      message: 'Please fill in all required fields',
      type: 'error',
      duration: 5000
    });
    return;
  }
  
  submitting.value = true;
  try {
    // Format the date to YYYY-MM-DD
    const formattedDate = newPPS.value.effective_date.toISOString().split('T')[0];
    
    const ppsData = {
      effective_date: formattedDate,
      price_per_share: newPPS.value.price_per_share.toString()
    };
    
    await ppsService.createPPS(ppsData);
    
    ElNotification({
      title: 'Success',
      message: 'Price Per Share record created successfully',
      type: 'success',
      duration: 3000
    });
    ppsDialog.value = false;
    
    // Refresh data
    await fetchPPSData();
  } catch (error) {
    console.error('Error creating PPS record:', error);
    ElNotification({
      title: 'Error',
      message: `Failed to create PPS record: ${error.message}`,
      type: 'error',
      duration: 5000
    });
  } finally {
    submitting.value = false;
  }
};

const formatPPS = (price) => {
  return `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
};

// Initialize component
onMounted(async () => {
  await fetchPPSData();
});
</script>

<template>
  <div class="pps-management">
    <h2>Price Per Share (PPS) Management</h2>
    
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>Loading PPS data...</p>
    </div>
    
    <div v-else class="pps-content">
      <!-- Current PPS card -->
      <el-card class="current-pps-card mb-4">
        <template #header>
          <div>
            <div class="card-title">Current Price Per Share</div>
            <div class="card-subtitle">The currently effective price per share for equity calculations</div>
          </div>
        </template>
        
        <div class="current-pps-container">
          <div class="current-value-container">
            <div v-if="currentPPS" class="current-pps-details">
              <div class="pps-value">{{ formattedCurrentPPS }}</div>
              <div class="pps-effective-date">
                Effective since {{ new Date(currentPPS.effective_date).toLocaleDateString() }}
              </div>
            </div>
            <div v-else class="no-pps-message">
              No Price Per Share has been set. Please add a PPS record to enable grant valuations.
            </div>
          </div>
        </div>
        
        <template #footer>
          <el-button v-if="userIsAdmin" @click="openNewPPSDialog" type="primary" plain>
            <el-icon class="el-icon--left"><Plus /></el-icon> Set New Price Per Share
          </el-button>
        </template>
      </el-card>
      
      <!-- PPS History table -->
      <el-card class="pps-history mb-4">
        <template #header>
          <div>
            <div class="card-title">Price Per Share History</div>
            <div class="card-subtitle">Historical record of all price per share values</div>
          </div>
        </template>
        
        <el-table :data="ppsHistory" stripe style="width: 100%">
          <el-table-column prop="effective_date" label="Effective Date">
            <template #default="scope">
              {{ new Date(scope.row.effective_date).toLocaleDateString() }}
            </template>
          </el-table-column>
          <el-table-column prop="price_per_share" label="Price Per Share">
            <template #default="scope">
              {{ formatPPS(scope.row.price_per_share) }}
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="Created On">
            <template #default="scope">
              {{ new Date(scope.row.created_at).toLocaleString() }}
            </template>
          </el-table-column>
        </el-table>
        
        <div class="pagination-container">
          <el-pagination
            v-model:currentPage="currentPage"
            :page-size="rowsPerPage"
            :total="totalPPSEntries"
            layout="total, prev, pager, next"
            @current-change="onPageChange"
          />
        </div>
      </el-card>
    </div>
    
    <!-- Dialog for adding new PPS -->
    <el-dialog
      v-model="ppsDialog"
      title="Set New Price Per Share"
      width="450px"
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
    >
      <div class="form-field mb-3">
        <label for="price-per-share">Price Per Share</label>
        <div class="input-group">
          <span class="input-prefix">$</span>
          <el-input-number
            id="price-per-share"
            v-model="newPPS.price_per_share"
            :min="0.001"
            :precision="3"
            placeholder="Enter Price Per Share"
            :disabled="submitting"
            style="width: 100%"
          />
        </div>
      </div>
      
      <div class="form-field mb-3">
        <label for="effective-date">Effective Date</label>
        <el-date-picker
          id="effective-date"
          v-model="newPPS.effective_date"
          type="date"
          placeholder="YYYY-MM-DD"
          format="YYYY-MM-DD"
          :disabled="submitting"
          style="width: 100%"
        />
        <small class="helper-text">The date from which this price per share becomes effective.</small>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="ppsDialog = false" :disabled="submitting">
            <el-icon class="el-icon--left"><Close /></el-icon> Cancel
          </el-button>
          <el-button type="primary" @click="submitNewPPS" :loading="submitting">
            <el-icon class="el-icon--left"><Check /></el-icon> Save
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.pps-management {
  padding: 0 1rem 1rem 1rem; /* Removed top padding */
}

.pps-management > h2 { /* Target the direct h2 child for page title styling */
  margin-top: 0;
  margin-bottom: 1.5rem; /* Space before the first card */
  font-size: 1.75rem; /* Consistent with Dashboard's h1 if desired, or keep as h2 default */
}

.mb-4 {
  margin-bottom: 1rem;
}

.mb-3 {
  margin-bottom: 0.75rem;
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

.card-title {
  font-weight: bold;
  font-size: 1.1rem;
}

.card-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 0.9rem;
}

.current-pps-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.current-value-container {
  text-align: center;
}

.current-pps-details {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pps-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--el-color-primary);
  margin-bottom: 0.5rem;
}

.pps-effective-date {
  font-size: 1rem;
  color: var(--el-text-color-secondary);
}

.no-pps-message {
  padding: 1rem;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-style: italic;
  color: var(--el-text-color-secondary);
}

.pagination-container {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.form-field {
  margin-bottom: 1rem;
}

.form-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.input-group {
  display: flex;
  align-items: center;
}

.input-prefix {
  padding: 0 10px;
  background-color: #f5f7fa;
  border: 1px solid var(--el-border-color);
  border-right: none;
  border-radius: 4px 0 0 4px;
  line-height: 32px;
}

.input-group .el-input-number {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.helper-text {
  display: block;
  margin-top: 0.25rem;
  color: var(--el-text-color-secondary);
  font-size: 0.875rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .pps-value {
    font-size: 2rem;
  }
}
</style>
