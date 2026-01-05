<template>
  <div class="api-manager-container">
    <h2>API管理</h2>
    <api-manager-component></api-manager-component>
  </div>
</template>

<script setup>
import ApiManagerComponent from '../components/ApiManagerComponent.vue'
</script>

<style scoped>
.api-manager-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
</style>
