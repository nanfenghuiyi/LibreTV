<template>
  <div class="settings-container">
    <h2>设置</h2>
    <settings-component></settings-component>
  </div>
</template>

<script setup>
import SettingsComponent from '../components/SettingsComponent.vue'
</script>

<style scoped>
.settings-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
</style>
