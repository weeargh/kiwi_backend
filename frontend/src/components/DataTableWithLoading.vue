<template>
  <div class="data-table-container">
    <!-- Authentication error display -->
    <ErrorDisplay 
      v-if="authError" 
      severity="auth" 
      title="Authentication Required" 
      :message="authError" 
      :dismissible="false" 
    />
    
    <!-- Data error display -->
    <ErrorDisplay 
      v-if="error" 
      severity="error" 
      title="Data Loading Error" 
      :message="error" 
    />
    
    <!-- Loading state -->
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>{{ loadingMessage || 'Loading data...' }}</p>
    </div>
    
    <!-- Empty state -->
    <div v-else-if="isEmpty" class="empty-container">
      <div class="empty-icon">
        <el-icon><Folder /></el-icon> <!-- Changed Inbox to Folder -->
      </div>
      <h3>{{ emptyTitle || 'No Data Available' }}</h3>
      <p>{{ emptyMessage || 'There are no records to display at this time.' }}</p>
      <slot name="empty-actions"></slot>
    </div>
    
    <!-- Data table -->
    <div v-else-if="!authError && !error && !loading && !isEmpty">
      <div v-if="title || subtitle" class="table-header">
        <h3 v-if="title" class="table-title">{{ title }}</h3>
        <p v-if="subtitle" class="table-subtitle">{{ subtitle }}</p>
      </div>
      
      <el-table
        :data="value"
        v-loading="tableLoading"
        :row-key="dataKey"
        v-bind="$attrs"
        @sort-change="onSort"
      >
        <slot></slot>
      </el-table>
      
      <el-pagination
        v-if="paginator"
        layout="total, sizes, prev, pager, next"
        :total="totalRecords"
        :page-size="rows"
        :page-sizes="rowsPerPageOptions"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Loading, Folder } from '@element-plus/icons-vue'; // Changed Inbox to Folder
import ErrorDisplay from './ErrorDisplay.vue';

defineOptions({
  inheritAttrs: false
});

const props = defineProps({
  // Data state
  value: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  tableLoading: {
    type: Boolean,
    default: false
  },
  authError: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  
  // Table configuration
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  lazy: {
    type: Boolean,
    default: false
  },
  paginator: {
    type: Boolean,
    default: true
  },
  rows: {
    type: Number,
    default: 10
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  rowsPerPageOptions: {
    type: Array,
    default: () => [10, 20, 50]
  },
  dataKey: {
    type: String,
    default: 'id'
  },
  filters: {
    type: Object,
    default: () => ({})
  },
  filterDisplay: {
    type: String,
    default: 'menu'
  },
  globalFilterFields: {
    type: Array,
    default: () => []
  },
  
  // Custom messages
  loadingMessage: {
    type: String,
    default: ''
  },
  emptyTitle: {
    type: String,
    default: ''
  },
  emptyMessage: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['page', 'sort', 'filter']);

// Computed properties
const isEmpty = computed(() => {
  return !props.value || props.value.length === 0;
});

// Event handlers for Element Plus pagination
const handleSizeChange = (size) => {
  emit('page', { page: 0, rows: size });
};

const handleCurrentChange = (currentPage) => {
  emit('page', { page: currentPage - 1, rows: props.rows });
};

// Event handlers
const onSort = (event) => {
  const { prop, order } = event;
  emit('sort', { 
    field: prop,
    order: order === 'descending' ? -1 : 1
  });
};
</script>

<style scoped>
.data-table-container {
  margin-bottom: 1.5rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.loading-container .el-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: var(--el-color-primary);
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  color: #909399;
  margin-bottom: 1rem;
}

.empty-icon .el-icon {
  font-size: 2.5rem;
}

.empty-container h3 {
  margin: 0 0 0.5rem 0;
  color: #303133;
}

.empty-container p {
  margin: 0 0 1rem 0;
  color: #909399;
  max-width: 300px;
}

.table-header {
  margin-bottom: 1rem;
}

.table-title {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
}

.table-subtitle {
  margin: 0;
  color: #909399;
  font-size: 0.875rem;
}

.el-pagination {
  margin-top: 1rem;
  justify-content: flex-end;
}
</style>
