<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import poolService from '../services/poolService';
import ppsService from '../services/ppsService';
import { ElNotification } from 'element-plus';

// Add basic functionality
const poolData = ref(null);
const loading = ref(false);
const authError = ref('');
const dataError = ref('');

// A simple fetchPoolData function
const fetchPoolData = async () => {
  loading.value = true;
  try {
    const result = await poolService.getPool();
    if (result && result.data) {
      poolData.value = result.data;
    } else if (result) {
      poolData.value = result;
    }
  } catch (error) {
    console.error('Error fetching pool data:', error);
    dataError.value = `Failed to load pool data: ${error.message || 'Unknown error'}`;
  } finally {
    loading.value = false;
  }
};

// Initialize component
onMounted(async () => {
  await fetchPoolData();
});
</script>

<template>
  <div class="pool-management">
    <h2>Equity Pool Management</h2>
    
    <!-- Loading and error states -->
    <div v-if="loading">Loading...</div>
    <div v-if="authError" class="error">{{ authError }}</div>
    <div v-if="dataError" class="error">{{ dataError }}</div>
    
    <!-- Pool data display -->
    <div v-if="poolData" class="pool-data">
      <p>Pool data loaded successfully</p>
    </div>
  </div>
</template>

<style scoped>
.pool-management {
  padding: 1rem;
}
.error {
  color: red;
  margin: 1rem 0;
}
</style>
