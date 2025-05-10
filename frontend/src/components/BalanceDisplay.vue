<template>
  <div class="balance-display">
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><Loading /></el-icon>
      <p>Loading balance data...</p>
    </div>
    
    <ErrorDisplay 
      v-if="authError" 
      severity="auth" 
      title="Authentication Required" 
      :message="authError" 
      :dismissible="false" 
    />
    
    <ErrorDisplay 
      v-if="error" 
      severity="error" 
      title="Error Loading Balance" 
      :message="error" 
    />
    
    <el-card v-if="!loading && !error && !authError" class="balance-card">
      <template #header>
        <div class="card-header">
          <div class="title-section">
            <h3>{{ title }}</h3>
            <p v-if="description" class="description">{{ description }}</p>
          </div>
          <div v-if="showRefreshButton" class="refresh-button">
            <el-button :icon="Refresh" @click="refresh" :disabled="loading" circle text />
          </div>
        </div>
      </template>
      
      <div class="balance-content">
        <slot name="default">
          <!-- Default content if no slot content provided -->
          <div class="balance-amount">
            <div class="label">{{ amountLabel || 'Balance' }}</div>
            <div class="value">{{ formattedAmount }}</div>
          </div>
          
          <div v-if="secondaryAmount !== undefined" class="secondary-amount">
            <div class="label">{{ secondaryLabel || 'Value' }}</div>
            <div class="value">{{ formattedSecondaryAmount }}</div>
          </div>
          
          <div v-if="details && details.length > 0" class="balance-details">
            <div v-for="(detail, index) in details" :key="index" class="detail-item">
              <div class="detail-label">{{ detail.label }}</div>
              <div class="detail-value">{{ detail.value }}</div>
            </div>
          </div>
        </slot>
      </div>
      
      <template #footer>
        <slot name="footer"></slot>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { ElCard, ElButton } from 'element-plus';
import { Loading, RefreshRight as Refresh } from '@element-plus/icons-vue';
import ErrorDisplay from './ErrorDisplay.vue';
import { formatDisplayDecimal, formatPrice } from '../utils/dataUtils';

const props = defineProps({
  loading: {
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
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  amount: {
    type: [Number, String],
    default: 0
  },
  amountLabel: {
    type: String,
    default: 'Balance'
  },
  secondaryAmount: {
    type: [Number, String],
    default: undefined
  },
  secondaryLabel: {
    type: String,
    default: 'Value'
  },
  showCurrency: {
    type: Boolean,
    default: false
  },
  details: {
    type: Array,
    default: () => []
  },
  showRefreshButton: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['refresh']);

// Computed properties for formatted values
const formattedAmount = computed(() => {
  if (props.amount === null || props.amount === undefined) return '-';
  return props.showCurrency 
    ? formatPrice(props.amount) 
    : formatDisplayDecimal(props.amount);
});

const formattedSecondaryAmount = computed(() => {
  if (props.secondaryAmount === null || props.secondaryAmount === undefined) return '-';
  return props.showCurrency 
    ? formatPrice(props.secondaryAmount) 
    : formatDisplayDecimal(props.secondaryAmount);
});

// Methods
const refresh = () => {
  emit('refresh');
};
</script>

<style scoped>
.balance-display {
  margin-bottom: 1.5rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: #f5f7fa;
  border-radius: 6px;
}

.loading-container .el-icon {
  font-size: 2rem;
  color: var(--el-color-primary);
  margin-bottom: 1rem;
}

.balance-card {
  margin-bottom: 1rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title-section {
  flex: 1;
}

.title-section h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
}

.title-section .description {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 0.875rem;
}

.balance-content {
  padding: 0.5rem 0;
}

.balance-amount {
  margin-bottom: 1rem;
}

.balance-amount .label,
.secondary-amount .label {
  font-size: 0.875rem;
  color: var(--el-text-color-secondary);
  margin-bottom: 0.25rem;
}

.balance-amount .value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--el-color-primary);
}

.secondary-amount .value {
  font-size: 1.25rem;
  font-weight: 600;
}

.balance-details {
  margin-top: 1.5rem;
  border-top: 1px solid var(--el-border-color);
  padding-top: 1rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.detail-label {
  color: var(--el-text-color-secondary);
}

.detail-value {
  font-weight: 600;
}
</style>
