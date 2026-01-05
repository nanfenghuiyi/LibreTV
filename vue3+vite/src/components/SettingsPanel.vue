<template>
  <div class="settings-panel" :class="{ 'show': isVisible }">
    <div class="settings-panel-overlay" @click="close"></div>
    <div class="settings-panel-content">
      <div class="settings-panel-header">
        <h3 class="settings-panel-title">设置</h3>
        <button class="settings-panel-close" @click="close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="settings-panel-body">
        <SettingsComponent />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SettingsComponent from './SettingsComponent.vue'

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
.settings-panel {
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

.settings-panel.show {
  transform: translateX(0);
}

.settings-panel-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: -1;
}

.settings-panel-content {
  background-color: #111;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.settings-panel-header {
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

.settings-panel-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.settings-panel-close {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: color 0.2s, background-color 0.2s;
}

.settings-panel-close:hover {
  color: #fff;
  background-color: #333;
}

.settings-panel-body {
  padding: 16px;
  flex: 1;
}
</style>