<template>
  <div class="grant-list-page">
    <h2>Grant Management</h2>
    
    <el-card>
      <div v-if="isLoading" class="loading-container">
        <el-icon class="is-loading" :size="30"><Loading /></el-icon>
        <p>Loading grants...</p>
      </div>
      
      <div v-else-if="fetchError" class="error-message">
        <el-alert
          :title="fetchError"
          type="error"
          :closable="false"
          show-icon
        />
      </div>
      
      <el-table v-else :data="grants" style="width: 100%" stripe>
        <template #header>
          <div class="table-header-actions">
            <el-button type="primary" size="small" @click="openCreateGrantDialog">
              <el-icon class="el-icon--left"><Plus /></el-icon>
              Create Grant
            </el-button>
            <!-- TODO: Bulk Create Grants Button -->
          </div>
        </template>
        
        <el-table-column prop="employee_name" label="Employee" sortable min-width="200">
          <template #default="scope">
            {{ scope.row.first_name }} {{ scope.row.last_name }} ({{ scope.row.employee_email }})
          </template>
        </el-table-column>
        <el-table-column prop="grant_date" label="Grant Date" sortable width="140">
          <template #default="scope">
            {{ formatDate(scope.row.grant_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="share_amount" label="Shares Granted" sortable width="150" align="right">
           <template #default="scope">{{ formatNumber(scope.row.share_amount) }}</template>
        </el-table-column>
        <el-table-column prop="vested_amount" label="Shares Vested" sortable width="150" align="right">
            <template #default="scope">{{ formatNumber(scope.row.vested_amount) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="Status" sortable width="120">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="100" fixed="right" align="center">
          <template #default="scope">
            <el-tooltip content="View Details" placement="top">
              <el-button 
                :icon="View" 
                size="small" 
                circle
                text
                @click="openViewGrantDialog(scope.row)"
              />
            </el-tooltip>
            <!-- TODO: Edit/Terminate Actions -->
          </template>
        </el-table-column>
        
        <template #empty>
          <div class="empty-data-message">No grants found.</div>
        </template>
      </el-table>
      
      <div class="pagination-container" v-if="totalGrants > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="rowsPerPage"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalGrants"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- Create Grant Dialog -->
    <el-dialog
      v-model="createGrantDialogVisible"
      title="Create New Grant"
      width="500px"
      :close-on-click-modal="!isCreatingGrant"
      @closed="resetNewGrantForm"
    >
      <el-form ref="createGrantFormRef" :model="newGrantData" :rules="grantFormRules" label-position="top">
        <el-form-item label="Employee" prop="employee_id">
          <el-select 
            v-model="newGrantData.employee_id" 
            placeholder="Select employee" 
            filterable 
            style="width: 100%;"
            :loading="loadingEmployees"
          >
            <el-option 
              v-for="employee in activeEmployees" 
              :key="employee.employee_id" 
              :label="`${employee.first_name} ${employee.last_name} (${employee.email})`" 
              :value="employee.employee_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Grant Date" prop="grant_date">
          <el-date-picker 
            v-model="newGrantData.grant_date" 
            type="date" 
            placeholder="Select grant date"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="Share Amount" prop="share_amount">
          <el-input-number 
            v-model="newGrantData.share_amount" 
            :precision="3" 
            :min="0.001" 
            placeholder="Enter share amount"
            style="width: 100%;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createGrantDialogVisible = false" :disabled="isCreatingGrant">Cancel</el-button>
          <el-button type="primary" @click="handleCreateGrant" :loading="isCreatingGrant">Create Grant</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- View Grant Details Dialog -->
    <el-dialog 
      v-model="viewGrantDialogVisible" 
      title="Grant Details" 
      width="70%" 
      :style="{ maxWidth: '900px' }"
      @closed="selectedGrantDetails = null"
    >
      <div v-if="isLoadingGrantDetails" class="loading-container">
        <el-icon class="is-loading" :size="30"><Loading /></el-icon>
        <p>Loading grant details...</p>
      </div>
      <div v-else-if="selectedGrantDetails" class="grant-details-content">
        <div class="grant-info">
          <div class="info-row">
            <div class="info-item"><strong>Grant ID:</strong> {{ selectedGrantDetails.grant_id }}</div>
            <div class="info-item"><strong>Employee:</strong> {{ selectedGrantDetails.first_name }} {{ selectedGrantDetails.last_name }} ({{ selectedGrantDetails.employee_email }})</div>
          </div>
          <div class="info-row">
            <div class="info-item"><strong>Grant Date:</strong> {{ formatDate(selectedGrantDetails.grant_date) }}</div>
            <div class="info-item"><strong>Shares Granted:</strong> {{ formatNumber(selectedGrantDetails.share_amount) }}</div>
          </div>
          <div class="info-row">
            <div class="info-item"><strong>Shares Vested:</strong> {{ formatNumber(selectedGrantDetails.vested_amount) }}</div>
            <div class="info-item"><strong>Status:</strong> <el-tag :type="getStatusType(selectedGrantDetails.status)">{{ selectedGrantDetails.status }}</el-tag></div>
          </div>
          <div v-if="selectedGrantDetails.termination_date" class="info-row">
            <div class="info-item"><strong>Termination Date:</strong> {{ formatDate(selectedGrantDetails.termination_date) }}</div>
            <div class="info-item"><strong>Reason:</strong> {{ selectedGrantDetails.termination_reason || 'N/A' }}</div>
          </div>
        </div>
        
        <h3 v-if="selectedGrantDetails.vesting_events && selectedGrantDetails.vesting_events.length > 0">Vesting Schedule</h3>
        <el-table 
          v-if="selectedGrantDetails.vesting_events && selectedGrantDetails.vesting_events.length > 0" 
          :data="selectedGrantDetails.vesting_events" 
          stripe 
          border 
          size="small"
          max-height="300px"
        >
          <el-table-column prop="vest_date" label="Vest Date" width="120">
            <template #default="scope">{{ formatDate(scope.row.vest_date) }}</template>
          </el-table-column>
          <el-table-column prop="shares_vested" label="Shares Vested" width="140" align="right">
            <template #default="scope">{{ formatNumber(scope.row.shares_vested) }}</template>
          </el-table-column>
          <el-table-column prop="pps_snapshot" label="PPS Snapshot" width="140" align="right">
            <template #default="scope">{{ scope.row.pps_snapshot ? '$' + formatNumber(scope.row.pps_snapshot) : 'N/A' }}</template>
          </el-table-column>
          <!-- Add other vesting event details if available/needed -->
        </el-table>
        <p v-else-if="selectedGrantDetails.vesting_events">No vesting events calculated yet for this grant.</p>
      </div>
      <div v-else>
        <p>Could not load grant details.</p>
      </div>
      <template #footer>
        <el-button @click="viewGrantDialogVisible = false">Close</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import apiClient from '../services/apiClient';
import { 
  ElCard, ElTable, ElTableColumn, ElButton, ElIcon, ElTag, ElPagination, 
  ElNotification, ElMessageBox, ElAlert, ElTooltip, ElDialog, ElForm, ElFormItem, 
  ElInputNumber, ElDatePicker, ElSelect, ElOption
} from 'element-plus';
import { Loading, Plus, View } from '@element-plus/icons-vue'; 
import { formatDisplayDecimal } from '../utils/dataUtils';

const grants = ref([]);
const isLoading = ref(false);
const fetchError = ref(null);

// Pagination state
const currentPage = ref(1);
const rowsPerPage = ref(10);
const totalGrants = ref(0);

// Create Grant Dialog
const createGrantDialogVisible = ref(false);
const createGrantFormRef = ref(null);
const isCreatingGrant = ref(false);
const newGrantData = ref({
  employee_id: '',
  grant_date: '',
  share_amount: null,
});
const activeEmployees = ref([]);
const loadingEmployees = ref(false);

const grantFormRules = reactive({
  employee_id: [{ required: true, message: 'Please select an employee', trigger: 'change' }],
  grant_date: [{ required: true, message: 'Please select a grant date', trigger: 'change' }],
  share_amount: [
    { required: true, message: 'Share amount is required', trigger: 'blur' },
    { type: 'number', min: 0.001, message: 'Share amount must be greater than 0', trigger: 'blur' }
  ],
});

// View Grant Details Dialog
const viewGrantDialogVisible = ref(false);
const selectedGrantDetails = ref(null);
const isLoadingGrantDetails = ref(false);

const fetchGrants = async () => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await apiClient.get('/grants', {
      params: {
        page: currentPage.value,
        limit: rowsPerPage.value,
      }
    });
    if (response.data?.success && response.data.data) {
      grants.value = response.data.data.items;
      totalGrants.value = response.data.data.pagination.total_items;
    } else {
      throw new Error(response.data?.error?.message || 'Invalid data structure from API');
    }
  } catch (error) {
    console.error("Error fetching grants:", error);
    fetchError.value = error.message || 'Failed to fetch grants.';
    ElNotification({ title: 'Error fetching grants', message: fetchError.value, type: 'error', duration: 5000 });
  } finally {
    isLoading.value = false;
  }
};

const fetchActiveEmployees = async () => {
  loadingEmployees.value = true;
  try {
    const response = await apiClient.get('/employees', { params: { status: 'active', limit: 1000 } }); 
    if (response.data?.success && response.data.data?.items) {
      activeEmployees.value = response.data.data.items;
    } else {
      activeEmployees.value = [];
    }
  } catch (error) {
    console.error("Error fetching active employees:", error);
    ElNotification({ title: 'Error', message: 'Could not load employees for selection.', type: 'error' });
    activeEmployees.value = [];
  } finally {
    loadingEmployees.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString();
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0.000';
  return formatDisplayDecimal(num);
};

const getStatusType = (status) => {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'warning';
    default: return 'info';
  }
};

const handleSizeChange = (val) => {
  rowsPerPage.value = val;
  fetchGrants();
};

const handleCurrentChange = (val) => {
  currentPage.value = val;
  fetchGrants();
};

const resetNewGrantForm = () => {
  newGrantData.value = { employee_id: '', grant_date: '', share_amount: null };
  createGrantFormRef.value?.resetFields();
};

const openCreateGrantDialog = () => {
  resetNewGrantForm();
  if (activeEmployees.value.length === 0) { 
    fetchActiveEmployees();
  }
  createGrantDialogVisible.value = true;
};

const handleCreateGrant = async () => {
  if (!createGrantFormRef.value) return;
  await createGrantFormRef.value.validate(async (valid) => {
    if (valid) {
      isCreatingGrant.value = true;
      try {
        await apiClient.post('/grants', newGrantData.value);
        ElNotification({ title: 'Success', message: 'Grant created successfully.', type: 'success' });
        createGrantDialogVisible.value = false;
        fetchGrants(); 
      } catch (error) {
        console.error("Error creating grant:", error);
        const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to create grant.';
        ElNotification({ title: 'Error Creating Grant', message: errorMessage, type: 'error', duration: 7000 });
      } finally {
        isCreatingGrant.value = false;
      }
    }
  });
};

const fetchGrantDetailsWithVesting = async (grantId) => {
  isLoadingGrantDetails.value = true;
  selectedGrantDetails.value = null;
  try {
    const [grantRes, vestingEventsRes] = await Promise.all([
      apiClient.get(`/grants/${grantId}`),
      apiClient.get(`/grants/${grantId}/vesting-events`) // Assuming page 1, default limit for now
    ]);

    if (grantRes.data?.success && grantRes.data.data) {
      selectedGrantDetails.value = grantRes.data.data;
      if (vestingEventsRes.data?.success && vestingEventsRes.data.data?.items) {
        selectedGrantDetails.value.vesting_events = vestingEventsRes.data.data.items;
      } else {
        selectedGrantDetails.value.vesting_events = [];
      }
    } else {
      throw new Error(grantRes.data?.error?.message || 'Failed to load grant details.');
    }
  } catch (error) {
    console.error(`Error fetching details for grant ${grantId}:`, error);
    ElNotification({ title: 'Error', message: `Could not load details for grant: ${error.message}`, type: 'error' });
    selectedGrantDetails.value = null; // Ensure it's null on error
  } finally {
    isLoadingGrantDetails.value = false;
  }
};

const openViewGrantDialog = (grant) => {
  viewGrantDialogVisible.value = true;
  fetchGrantDetailsWithVesting(grant.grant_id);
};

onMounted(() => {
  fetchGrants();
  fetchActiveEmployees(); 
});
</script>

<style scoped>
.grant-list-page {
  padding: 0 1rem 1rem 1rem; 
}

.grant-list-page > h2 {
  margin-top: 0;
  margin-bottom: 1.5rem; 
  font-size: 1.75rem; 
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  min-height: 200px;
}

.loading-container .el-icon {
  font-size: 2rem;
  color: var(--el-color-primary);
  margin-bottom: 1rem;
}

.error-message {
  margin-bottom: 1rem;
}

.table-header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.empty-data-message {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* Grant Details Dialog Styles */
.grant-details-content .grant-info {
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}
.grant-details-content .info-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem; /* More space between items in a row */
  margin-bottom: 0.75rem;
}
.grant-details-content .info-item {
  flex: 1 1 calc(33.333% - 1rem); /* Adjust for gap */
  min-width: 220px; 
}
.grant-details-content .info-item strong { /* Replaces .label class */
  font-weight: bold;
  color: var(--el-text-color-secondary);
  margin-right: 0.5em;
}
.grant-details-content .info-item.full-width {
  flex-basis: 100%;
}
.grant-details-content .info-item .notes { /* For multiline notes */
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 0.25em;
}
.grant-details-content h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--el-border-color-light, #ebeef5);
  padding-bottom: 0.5rem;
}
</style>
