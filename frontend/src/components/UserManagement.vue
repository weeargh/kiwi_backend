<template>
  <div class="user-management-container">
    <div class="page-header">
      <h1>User Management</h1>
    </div>
    <el-card>
      <!-- Card header template removed as title is now outside -->
      
      <div v-if="isLoading" class="loading-container">
        <el-icon class="is-loading"><Loading /></el-icon>
        <p>Loading users...</p>
      </div>
      
      <div v-else-if="fetchError" class="error-message">
        <el-alert
          :title="fetchError"
          type="error"
          :closable="false"
          show-icon
        />
      </div>
      
      <el-table v-else :data="users" style="width: 100%">
        <template #header>
          <div class="table-header">
            <span>Users</span>
            <el-button type="primary" size="small" @click="openInviteDialog">
              <el-icon class="el-icon--left"><Plus /></el-icon>
              Invite User
            </el-button>
          </div>
        </template>
        
        <el-table-column prop="name" label="Name" sortable />
        <el-table-column prop="email" label="Email" sortable />
        <el-table-column prop="role" label="Role" sortable />
        <el-table-column prop="status" label="Status" sortable>
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="Created At" sortable>
          <template #default="scope">
            {{ scope.row.created_at ? new Date(scope.row.created_at).toLocaleString() : 'N/A' }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="180">
          <template #default="scope">
            <el-button 
              size="small" 
              type="success" 
              circle
              @click="editUser(scope.row)"
            >
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              circle
              @click="confirmDeleteUser(scope.row)"
              :disabled="scope.row.status === 'inactive' || scope.row.deleted_at !== null"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
        
        <template #empty>
          <div class="empty-data">No users found.</div>
        </template>
      </el-table>
      
      <div class="pagination-container" v-if="users.length > 0">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :page-sizes="[10, 20, 50]"
          :total="users.length"
        />
      </div>
    </el-card>

    <!-- Invite Dialog -->
    <el-dialog
      v-model="inviteDialogVisible"
      title="Invite New User"
      width="450px"
      :close-on-click-modal="!isInviting"
      :close-on-press-escape="!isInviting"
    >
      <div class="form-field mb-3">
        <label for="inviteName">Name</label>
        <el-input 
          id="inviteName" 
          v-model="newUser.name" 
          placeholder="Enter name" 
          autofocus
          :disabled="isInviting"
        />
        <small class="form-error" v-if="submitted && !newUser.name">Name is required.</small>
      </div>
      
      <div class="form-field mb-3">
        <label for="inviteEmail">Email</label>
        <el-input 
          id="inviteEmail" 
          v-model="newUser.email" 
          placeholder="Enter email" 
          :disabled="isInviting"
        />
        <small class="form-error" v-if="submitted && !newUser.email">Email is required.</small>
      </div>
      
      <div class="form-field mb-3">
        <label for="inviteRole">Role</label>
        <el-select
          id="inviteRole"
          v-model="newUser.role"
          placeholder="Select a Role"
          style="width: 100%"
          :disabled="isInviting"
        >
          <el-option
            v-for="option in roles"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <small class="form-error" v-if="submitted && !newUser.role">Role is required.</small>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="hideInviteDialog" :disabled="isInviting">Cancel</el-button>
          <el-button type="primary" @click="inviteUser" :loading="isInviting">Invite</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Edit Dialog -->
    <el-dialog
      v-model="editDialogVisible"
      title="Edit User"
      width="450px"
      :close-on-click-modal="!isSaving"
      :close-on-press-escape="!isSaving"
    >
      <div class="form-field mb-3" v-if="editingUser">
        <label for="editName">Name</label>
        <el-input 
          id="editName" 
          v-model="editingUser.name" 
          placeholder="Enter name" 
          autofocus
          :disabled="isSaving"
        />
        <small class="form-error" v-if="submitted && !editingUser.name">Name is required.</small>
      </div>
      
      <div class="form-field mb-3" v-if="editingUser">
        <label for="editEmail">Email</label>
        <el-input 
          id="editEmail" 
          v-model="editingUser.email" 
          readonly
          disabled
        />
      </div>
      
      <div class="form-field mb-3" v-if="editingUser">
        <label for="editRole">Role</label>
        <el-select
          id="editRole"
          v-model="editingUser.role"
          placeholder="Select a Role"
          style="width: 100%"
          :disabled="isSaving"
        >
          <el-option
            v-for="option in roles"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <small class="form-error" v-if="submitted && !editingUser.role">Role is required.</small>
      </div>
      
      <div class="form-field mb-3" v-if="editingUser">
        <label for="editStatus">Status</label>
        <el-select
          id="editStatus"
          v-model="editingUser.status"
          placeholder="Select a Status"
          style="width: 100%"
          :disabled="isSaving"
        >
          <el-option
            v-for="option in statuses"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <small class="form-error" v-if="submitted && !editingUser.status">Status is required.</small>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="hideEditDialog" :disabled="isSaving">Cancel</el-button>
          <el-button type="primary" @click="saveUser" :loading="isSaving">Save</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '../services/apiClient';
import { ElNotification, ElMessageBox } from 'element-plus';
import { Loading, Plus, Edit, Delete } from '@element-plus/icons-vue';

const users = ref([]);
const isLoading = ref(false);
const fetchError = ref(null);

const inviteDialogVisible = ref(false);
const newUser = ref({ name: '', email: '', role: null });
const submitted = ref(false);
const isInviting = ref(false);
const roles = ref([
    { label: 'Admin', value: 'admin' },
    { label: 'Employee', value: 'employee' }
]);

const editDialogVisible = ref(false);
const editingUser = ref(null);
const isSaving = ref(false);
const statuses = ref([
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
]);

const fetchUsers = async () => {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const responseData = await apiClient.get('/users'); 
    if (responseData && responseData.data && Array.isArray(responseData.data.items)) {
        users.value = responseData.data.items;
    } else if (responseData && Array.isArray(responseData.items)) {
        users.value = responseData.items;
    } else if (Array.isArray(responseData)) {
        users.value = responseData;
    } else {
        console.warn('Unexpected response structure for users list:', responseData);
        users.value = [];
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    fetchError.value = error.message || 'Failed to fetch users.';
    ElNotification({
      title: `API Error (${error.code || 'Unknown'})`,
      message: fetchError.value,
      type: 'error',
      duration: 5000
    });
    users.value = [];
  }
  isLoading.value = false;
};

const getStatusType = (status) => {
  switch (status) {
    case 'active': return 'success';
    case 'inactive': return 'warning';
    default: return 'info';
  }
};

const openInviteDialog = () => {
  newUser.value = { name: '', email: '', role: null };
  submitted.value = false;
  inviteDialogVisible.value = true;
};

const hideInviteDialog = () => {
  inviteDialogVisible.value = false;
  submitted.value = false;
};

const inviteUser = async () => {
  submitted.value = true;
  if (!newUser.value.name || !newUser.value.email || !newUser.value.role) {
    return;
  }

  isInviting.value = true;
  try {
    const responseData = await apiClient.post('/users', newUser.value);
    ElNotification({
      title: 'Success',
      message: 'User Invited Successfully',
      type: 'success',
      duration: 3000
    });
    hideInviteDialog();
    fetchUsers();

  } catch (error) {
    console.error("Error inviting user:", error);
    ElNotification({
      title: `Invite Failed (${error.code || 'Unknown'})`,
      message: error.message || 'Could not invite user.',
      type: 'error',
      duration: 5000
    });
  }
  isInviting.value = false;
};

const editUser = (userToEdit) => {
  editingUser.value = { ...userToEdit };
  submitted.value = false;
  editDialogVisible.value = true;
};

const hideEditDialog = () => {
  editDialogVisible.value = false;
  submitted.value = false;
  editingUser.value = null;
};

const saveUser = async () => {
  submitted.value = true;
  if (!editingUser.value || !editingUser.value.name || !editingUser.value.role || !editingUser.value.status) {
      return;
  }

  isSaving.value = true;
  try {
      const updatePayload = {
          name: editingUser.value.name,
          role: editingUser.value.role,
          status: editingUser.value.status
      };
      const userId = editingUser.value.user_id;

      const responseData = await apiClient.patch(`/users/${userId}`, updatePayload);
      ElNotification({
        title: 'Success',
        message: 'User Updated Successfully',
        type: 'success',
        duration: 3000
      });
      hideEditDialog();
      fetchUsers();

  } catch (error) {
      console.error(`Error updating user ${editingUser.value?.user_id}:`, error);
      ElNotification({
        title: `Update Failed (${error.code || 'Unknown'})`,
        message: error.message || 'Could not update user.',
        type: 'error',
        duration: 5000
      });
  }
  isSaving.value = false;
};

const confirmDeleteUser = (userToDelete) => {
  ElMessageBox.confirm(
    `Are you sure you want to deactivate user ${userToDelete.name || userToDelete.email}? This is a soft delete.`,
    'Confirm Deactivation',
    {
      confirmButtonText: 'Deactivate',
      cancelButtonText: 'Cancel',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      await apiClient.delete(`/users/${userToDelete.user_id}`);
      ElNotification({
        title: 'Confirmed',
        message: 'User deactivated successfully',
        type: 'success',
        duration: 3000
      });
      fetchUsers();
    } catch (error) {
      console.error(`Error deactivating user ${userToDelete.user_id}:`, error);
      ElNotification({
        title: `Deactivation Failed (${error.code || 'Unknown'})`,
        message: error.message || 'Could not deactivate user.',
        type: 'error',
        duration: 5000
      });
    }
  }).catch(() => {
    ElNotification({
      title: 'Cancelled',
      message: 'User deactivation cancelled',
      type: 'info',
      duration: 3000
    });
  });
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.user-management-container {
  padding: 0 1rem 1rem 1rem; /* Standardized padding */
}

.page-header { /* New class for the header containing H1 */
  margin-bottom: 1.5rem; /* Space below header, before card */
}

.page-header h1 {
  margin-top: 0;
  margin-bottom: 0.5rem; /* Consistent with Dashboard.vue */
  font-size: 1.75rem; /* Consistent title size */
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.error-message {
  margin-bottom: 15px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}

.loading-container .el-icon {
  font-size: 2rem;
  color: var(--el-color-primary);
  margin-bottom: 1rem;
}

.empty-data {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
}

.pagination-container {
  margin-top: 20px;
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

.form-error {
  color: var(--el-color-danger);
  font-size: 0.75rem;
}

.mb-3 {
  margin-bottom: 0.75rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
