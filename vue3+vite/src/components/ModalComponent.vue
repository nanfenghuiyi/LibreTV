<template>
  <div 
    :class="['modal-overlay', modalType, { 'show': isVisible, 'hide': !isVisible && isTransitioning }]"
    @click="handleOverlayClick"
  >
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">{{ title }}</h3>
        <button class="modal-close" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <slot></slot>
      </div>
      <div class="modal-footer" v-if="hasFooter">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  modalType: {
    type: String,
    default: '',
    validator: (value) => {
      return ['password-modal', 'disclaimer-modal', ''].includes(value)
    }
  },
  hasFooter: {
    type: Boolean,
    default: false
  },
  closeOnClickOutside: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'close'])

const isVisible = ref(props.modelValue)
const isTransitioning = ref(false)

watch(() => props.modelValue, (newValue) => {
  isVisible.value = newValue
  if (newValue) {
    isTransitioning.value = false
  }
})

watch(isVisible, (newValue) => {
  if (!newValue) {
    isTransitioning.value = true
    setTimeout(() => {
      isTransitioning.value = false
      emit('update:modelValue', false)
      emit('close')
    }, 300) // Match the CSS transition duration
  } else {
    emit('update:modelValue', true)
  }
})

const closeModal = () => {
  isVisible.value = false
}

const handleOverlayClick = () => {
  if (props.closeOnClickOutside) {
    closeModal()
  }
}

// Export methods for external control
defineExpose({
  open: () => {
    isVisible.value = true
  },
  close: closeModal
})
</script>

<style scoped>
/* The main modal styles are already in the global CSS file. */
/* This component uses those global styles. */
</style>