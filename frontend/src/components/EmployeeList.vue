<template>
  <div class="employee-list-page">
    <h2>Employees</h2>
    
    <el-card>
      <div v-if="isLoading" class="loading-container">
        <el-icon class="is-loading" :size="30"><Loading /></el-icon>
        <p>Loading employees...</p>
      </div>
      
      <div v-else-if="fetchError" class="error-message">
        <el-alert
          :title="fetchError"
          type="error"
          :closable="false"
          show-icon
        />
      </div>
      
      <el-table v-else :data="employees" style="width: 100%" stripe>
        <template #header>
          <div class="table-header-actions">
            <el-button type="primary" size="small" @click="openCreateEmployeeDialog">
              <el-icon class="el-icon--left"><Plus /></el-icon>
              Create Employee
            </el-button>
            <el-button type="success" size="small" @click="openBulkCreateDialog" style="margin-left: 10px;">
              <el-icon class="el-icon--left"><UploadFilled /></el-icon>
              Bulk Create
            </el-button>
          </div>
        </template>
        
        <el-table-column prop="first_name" label="First Name" sortable />
        <el-table-column prop="last_name" label="Last Name" sortable />
        <el-table-column prop="email" label="Email" sortable />
        <el-table-column prop="status" label="Status" sortable width="120">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="Created At" sortable width="180">
          <template #default="scope">
            {{ scope.row.created_at ? new Date(scope.row.created_at).toLocaleString() : 'N/A' }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="120" fixed="right">
          <template #default="scope">
            <el-tooltip content="Edit Employee" placement="top">
              <el-button 
                :icon="Edit" 
                size="small" 
                circle
                type="primary"
                text
                @click="openEditEmployeeDialog(scope.row)"
              />
            </el-tooltip>
            <el-tooltip content="Deactivate Employee" placement="top">
              <el-button 
                :icon="Delete" 
                size="small" 
                circle
                type="danger"
                text
                @click="confirmDeactivateEmployee(scope.row)"
                :disabled="scope.row.status === 'inactive'"
              />
            </el-tooltip>
          </template>
        </el-table-column>
        
        <template #empty>
          <div class="empty-data-message">No employees found.</div>
        </template>
      </el-table>
      
      <div class="pagination-container" v-if="totalEmployees > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="rowsPerPage"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalEmployees"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- Create Employee Dialog -->
    <el-dialog
      v-model="createEmployeeDialogVisible"
      title="Create New Employee"
      width="500px"
      :close-on-click-modal="!isCreatingEmployee"
      @closed="resetNewEmployeeForm"
    >
      <el-form ref="createEmployeeFormRef" :model="newEmployeeData" :rules="employeeFormRules" label-position="top">
        <el-form-item label="First Name" prop="first_name">
          <el-input v-model="newEmployeeData.first_name" placeholder="Enter first name" />
        </el-form-item>
        <el-form-item label="Last Name" prop="last_name">
          <el-input v-model="newEmployeeData.last_name" placeholder="Enter last name" />
        </el-form-item>
        <el-form-item label="Email" prop="email">
          <el-input v-model="newEmployeeData.email" placeholder="Enter email address" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createEmployeeDialogVisible = false" :disabled="isCreatingEmployee">Cancel</el-button>
          <el-button type="primary" @click="handleCreateEmployee" :loading="isCreatingEmployee">Create</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Edit Employee Dialog -->
    <el-dialog
      v-model="editEmployeeDialogVisible"
      title="Edit Employee"
      width="500px"
      :close-on-click-modal="!isEditingEmployee"
      @closed="resetEditEmployeeForm"
    >
      <el-form v-if="employeeToEdit" ref="editEmployeeFormRef" :model="employeeToEdit" :rules="employeeFormRules" label-position="top">
        <el-form-item label="First Name" prop="first_name">
          <el-input v-model="employeeToEdit.first_name" placeholder="Enter first name" />
        </el-form-item>
        <el-form-item label="Last Name" prop="last_name">
          <el-input v-model="employeeToEdit.last_name" placeholder="Enter last name" />
        </el-form-item>
        <el-form-item label="Email" prop="email">
          <el-input v-model="employeeToEdit.email" placeholder="Enter email address" />
        </el-form-item>
        <el-form-item label="Status" prop="status">
          <el-select v-model="employeeToEdit.status" placeholder="Select status" style="width: 100%;">
            <el-option label="Active" value="active" />
            <el-option label="Inactive" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editEmployeeDialogVisible = false" :disabled="isEditingEmployee">Cancel</el-button>
          <el-button type="primary" @click="handleUpdateEmployee" :loading="isEditingEmployee">Save Changes</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Bulk Create Employees Dialog -->
    <el-dialog
      v-model="bulkCreateDialogVisible"
      title="Bulk Create Employees"
      width="600px"
      :close-on-click-modal="!isBulkCreating"
      @closed="bulkCreateData = ''"
    >
      <el-form label-position="top">
        <el-form-item label="Employee Data (CSV Format: email,first_name,last_name per line)">
          <el-input
            v-model="bulkCreateData"
            type="textarea"
            :rows="10"
            placeholder="john.doe@example.com,John,Doe&#10;jane.smith@example.com,Jane,Smith"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="bulkCreateDialogVisible = false" :disabled="isBulkCreating">Cancel</el-button>
          <el-button type="primary" @click="handleBulkCreateEmployees" :loading="isBulkCreating">Import Employees</el-button>
        </span>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import apiClient from '../services/apiClient'; 
import { 
  ElCard, ElTable, ElTableColumn, ElButton, ElIcon, ElTag, ElPagination, 
  ElNotification, ElMessageBox, ElAlert, ElTooltip, ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElOption
} from 'element-plus';
import { Loading, Plus, Edit, Delete, UploadFilled } from '@element-plus/icons-vue';

const employees = ref([]);
const isLoading = ref(false);
const fetchError = ref(null);

// Pagination state
const currentPage = ref(1);
const rowsPerPage = ref(10);
const totalEmployees = ref(0);

// Create Employee Dialog states
const createEmployeeDialogVisible = ref(false);
const createEmployeeFormRef = ref(null);
const isCreatingEmployee = ref(false);
const newEmployeeData = ref({
  email: '',
  first_name: '',
  last_name: '',
});

// Edit Employee Dialog states
const editEmployeeDialogVisible = ref(false);
const editEmployeeFormRef = ref(null);
const isEditingEmployee = ref(false);
const employeeToEdit = ref(null); 

// Bulk Create Dialog states
const bulkCreateDialogVisible = ref(false);
const bulkCreateData = ref('');
const isBulkCreating = ref(false);

const employeeFormRules = reactive({
  first_name: [{ required: true, message: 'First name is required', trigger: 'blur' }],
  last_name: [{ required: true, message: 'Last name is required', trigger: 'blur' }],
  email: [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Please input correct email address', trigger: ['blur', 'change'] },
  ],
  status: [{ required: true, message: 'Status is required', trigger: 'change' }],
});


const fetchEmployees = async () => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await apiClient.get('/employees', {
      params: {
        page: currentPage.value,
        limit: rowsPerPage.value,
      }
    });
    if (response.data && response.data.success && response.data.data) {
      employees.value = response.data.data.items;
      totalEmployees.value = response.data.data.pagination.total_items;
    } else {
      employees.value = [];
      totalEmployees.value = 0;
      throw new Error(response.data?.error?.message || 'Invalid data structure from API');
    }
  } catch (error) {
    console.error("Error fetching employees:", error);
    fetchError.value = error.message || 'Failed to fetch employees.';
  } finally {
    isLoading.value = false;
  }
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
  fetchEmployees();
};

const handleCurrentChange = (val) => {
  currentPage.value = val;
  fetchEmployees();
};

// Create Employee Logic
const resetNewEmployeeForm = () => {
  newEmployeeData.value = { email: '', first_name: '', last_name: '' };
  createEmployeeFormRef.value?.resetFields();
};

const openCreateEmployeeDialog = () => {
  resetNewEmployeeForm();
  createEmployeeDialogVisible.value = true;
};

const handleCreateEmployee = async () => {
  if (!createEmployeeFormRef.value) return;
  await createEmployeeFormRef.value.validate(async (valid) => {
    if (valid) {
      isCreatingEmployee.value = true;
      try {
        await apiClient.post('/employees', newEmployeeData.value);
        ElNotification({ title: 'Success', message: 'Employee created successfully.', type: 'success' });
        createEmployeeDialogVisible.value = false;
        fetchEmployees(); 
      } catch (error) {
        console.error("Error creating employee:", error);
        const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to create employee.';
        ElNotification({ title: 'Error', message: errorMessage, type: 'error', duration: 5000 });
      } finally {
        isCreatingEmployee.value = false;
      }
    }
  });
};

// Edit Employee Logic
const resetEditEmployeeForm = () => {
  employeeToEdit.value = null; 
  editEmployeeFormRef.value?.resetFields();
};

const openEditEmployeeDialog = (employee) => {
  employeeToEdit.value = { ...employee }; 
  editEmployeeDialogVisible.value = true;
};

const handleUpdateEmployee = async () => {
  if (!editEmployeeFormRef.value) return;
  await editEmployeeFormRef.value.validate(async (valid) => {
    if (valid && employeeToEdit.value) {
      isEditingEmployee.value = true;
      try {
        const payload = {
          first_name: employeeToEdit.value.first_name,
          last_name: employeeToEdit.value.last_name,
          email: employeeToEdit.value.email,
          status: employeeToEdit.value.status,
        };
        await apiClient.patch(`/employees/${employeeToEdit.value.employee_id}`, payload);
        ElNotification({ title: 'Success', message: 'Employee updated successfully.', type: 'success' });
        editEmployeeDialogVisible.value = false;
        fetchEmployees(); 
      } catch (error) {
        console.error("Error updating employee:", error);
        const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to update employee.';
        ElNotification({ title: 'Error', message: errorMessage, type: 'error', duration: 5000 });
      } finally {
        isEditingEmployee.value = false;
      }
    }
  });
};

// Deactivate Employee Logic
const confirmDeactivateEmployee = (employee) => {
  ElMessageBox.confirm(
    `Are you sure you want to deactivate employee ${employee.first_name} ${employee.last_name}? This will set their status to inactive.`,
    'Confirm Deactivation',
    {
      confirmButtonText: 'Deactivate',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await apiClient.delete(`/employees/${employee.employee_id}`);
      ElNotification({ title: 'Success', message: 'Employee deactivated successfully.', type: 'success' });
      fetchEmployees(); 
    } catch (error) {
      console.error("Error deactivating employee:", error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to deactivate employee.';
      ElNotification({ title: 'Error', message: errorMessage, type: 'error', duration: 5000 });
    }
  }).catch(() => {
    // User cancelled
  });
};

// Bulk Create Logic
const openBulkCreateDialog = () => {
  bulkCreateData.value = '';
  bulkCreateDialogVisible.value = true;
};

const handleBulkCreateEmployees = async () => {
  if (!bulkCreateData.value.trim()) {
    ElNotification({ title: 'Warning', message: 'Please paste employee data.', type: 'warning' });
    return;
  }

  const lines = bulkCreateData.value.trim().split('\n');
  const employeesToCreate = lines.map(line => {
    const [email, first_name, last_name] = line.split(',').map(s => s.trim());
    return { email, first_name, last_name };
  }).filter(emp => emp.email && emp.first_name && emp.last_name); // Basic validation

  if (employeesToCreate.length === 0) {
    ElNotification({ title: 'Error', message: 'No valid employee data found. Ensure format is email,first_name,last_name per line.', type: 'error' });
    return;
  }

  isBulkCreating.value = true;
  try {
    const response = await apiClient.post('/employees/bulk', { employees: employeesToCreate });
    const { created_count, errors } = response.data.data;
    let message = `${created_count} employee(s) created successfully.`;
    if (errors && errors.length > 0) {
      message += ` ${errors.length} employee(s) failed or were skipped (e.g., duplicates). Check console for details.`;
      console.warn('Bulk create errors:', errors);
    }
    ElNotification({ title: 'Bulk Create Result', message, type: created_count > 0 ? 'success' : 'warning', duration: 7000, dangerouslyUseHTMLString: false });
    bulkCreateDialogVisible.value = false;
    fetchEmployees();
  } catch (error) {
    console.error("Error bulk creating employees:", error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to bulk create employees.';
    ElNotification({ title: 'Bulk Create Error', message: errorMessage, type: 'error', duration: 5000 });
  } finally {
    isBulkCreating.value = false;
  }
};

onMounted(() => {
  fetchEmployees();
});
</script>

<style scoped>
.employee-list-page {
  padding: 0 1rem 1rem 1rem; /* Removed top padding */
}

.employee-list-page > h2 {
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
</style>
