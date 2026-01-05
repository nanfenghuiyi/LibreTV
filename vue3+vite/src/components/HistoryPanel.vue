<template>
  <div class="history-panel" :class="{ 'show': isVisible }">
    <div class="history-panel-overlay" @click="close"></div>
    <div class="history-panel-content">
      <div class="history-panel-header">
        <h3 class="history-panel-title">观看历史</h3>
        <button class="history-panel-close" @click="close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="history-panel-body">
        <HistoryComponent />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import HistoryComponent from './HistoryComponent.vue'

const isVisible = ref(false)

const toggle = () => {
  isVisible.value = !isVisible.value
}

const open = () => {
  isVisible.value = true
}

const close = () => {
  isVisible.value = false
}

defineExpose({
  toggle,
  open,
  close
})
</script>

<style scoped>
.history-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 400px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.history-panel.show {
  transform: translateX(0);
}

.history-panel-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: -1;
}

.history-panel-content {
  background-color: #111;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.history-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #333;
  background-color: #111;
  position: sticky;
  top: 0;
  z-index: 10;
}

.history-panel-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.history-panel-close {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: color 0.2s, background-color 0.2s;
}

.history-panel-close:hover {
  color: #fff;
  background-color: #333;
}

.history-panel-body {
  padding: 16px;
  flex: 1;
}
</style>