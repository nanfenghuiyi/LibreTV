<template>
  <div class="home-container">
    <h1>欢迎使用 LibreTV</h1>
    <search-component></search-component>
    <div class="content-wrapper">
      <div class="main-content">
        <douban-component></douban-component>
        <div id="results" class="results-container"></div>
      </div>
      <div class="sidebar">
        <history-component></history-component>
      </div>
    </div>
  </div>
</template>

<script setup>
import SearchComponent from '../components/SearchComponent.vue'
import DoubanComponent from '../components/DoubanComponent.vue'
import HistoryComponent from '../components/HistoryComponent.vue'
</script>

<style scoped>
.home-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.content-wrapper {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}

.main-content {
  flex: 1;
}

.sidebar {
  width: 300px;
  min-width: 300px;
}

@media (max-width: 768px) {
  .content-wrapper {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    min-width: auto;
  }
}
</style>
