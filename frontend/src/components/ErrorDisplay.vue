<template>
  <el-alert
    v-if="show"
    :type="alertType"
    :title="title || ''"
    :description="message"
    :closable="dismissible"
    :show-icon="true"
    @close="dismiss"
  >
    <template v-if="details" #default>
      <div class="error-details">{{ details }}</div>
    </template>
  </el-alert>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  severity: {
    type: String,
    default: 'error',
    validator: (value) => ['info', 'warning', 'error', 'auth'].includes(value)
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  dismissible: {
    type: Boolean,
    default: true
  },
  autoHide: {
    type: Number,
    default: 0 // 0 means don't auto hide
  }
});

const emit = defineEmits(['dismissed']);

const show = ref(true);

// Map our severity types to Element Plus alert types
const alertType = computed(() => {
  switch (props.severity) {
    case 'info': return 'info';
    case 'warning': return 'warning';
    case 'error': return 'error';
    case 'auth': return 'warning'; // Element Plus doesn't have 'auth' type, use warning
    default: return 'info';
  }
});

const dismiss = () => {
  show.value = false;
  emit('dismissed');
};

// Auto hide logic
if (props.autoHide > 0) {
  setTimeout(() => {
    dismiss();
  }, props.autoHide);
}

// Watch for changes to the message prop to reset visibility
watch(() => props.message, (newMessage) => {
  if (newMessage && !show.value) {
    show.value = true;
  }
});
</script>

<style scoped>
.el-alert {
  margin-bottom: 1rem;
}

.error-details {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  opacity: 0.8;
}
</style>
