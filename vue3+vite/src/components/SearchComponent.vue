<template>
  <div class="search-component">
    <div class="search-header">
      <h1>LibreTV</h1>
      <p>免费在线视频搜索与观看平台</p>
    </div>
    
    <div class="search-container">
      <div class="search-input-wrapper">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索电影、电视剧、动漫..."
          @keyup.enter="handleSearch"
          ref="searchInput"
        />
        <button @click="handleSearch" :disabled="searchLoading" class="search-btn">
          <span v-if="searchLoading">搜索中...</span>
          <span v-else>搜索</span>
        </button>
      </div>
      
      <div v-if="showHistory && recentSearches.length > 0" class="search-history">
        <h3>搜索历史</h3>
        <div class="history-list">
          <div
            v-for="(query, index) in recentSearches"
            :key="index"
            class="history-item"
            @click="selectHistory(query)"
          >
            <span>{{ query }}</span>
            <button @click.stop="removeHistory(query)" class="remove-btn">×</button>
          </div>
        </div>
        <button @click="clearHistory" class="clear-btn">清除历史</button>
      </div>
    </div>
    
    <div v-if="searchError" class="search-error">
      {{ searchError }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSearchStore } from '../store/searchStore'

const searchStore = useSearchStore()
const searchQuery = ref('')
const showHistory = ref(false)
const searchInput = ref(null)

const searchLoading = computed(() => searchStore.searchLoading)
const searchError = computed(() => searchStore.searchError)
const recentSearches = computed(() => searchStore.recentSearches)

onMounted(() => {
  searchStore.loadHistory()
  // 自动聚焦搜索框
  if (searchInput.value) {
    searchInput.value.focus()
  }
})

const handleSearch = async () => {
  if (searchQuery.value.trim()) {
    showHistory.value = false
    await searchStore.search(searchQuery.value.trim())
  }
}

const selectHistory = (query) => {
  searchQuery.value = query
  showHistory.value = false
  handleSearch()
}

const removeHistory = (query) => {
  // 从历史记录中移除单个查询
  searchStore.searchHistory = searchStore.searchHistory.filter(item => item !== query)
  localStorage.setItem('searchHistory', JSON.stringify(searchStore.searchHistory))
}

const clearHistory = () => {
  searchStore.clearHistory()
  showHistory.value = false
}

// 监听搜索框焦点，显示/隐藏历史记录
watch(() => searchQuery.value, (newValue) => {
  showHistory.value = newValue.trim() === '' && recentSearches.value.length > 0
})
</script>

<style scoped>
.search-component {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

.search-header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.search-header p {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 2rem;
}

.search-container {
  position: relative;
  max-width: 600px;
  margin: 0 auto;
}

.search-input-wrapper {
  display: flex;
  border-radius: 25px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.search-input-wrapper input {
  flex: 1;
  padding: 15px 20px;
  font-size: 1rem;
  border: none;
  outline: none;
}

.search-input-wrapper .search-btn {
  padding: 0 30px;
  background-color: #2563eb;
  color: white;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.search-input-wrapper .search-btn:hover {
  background-color: #1d4ed8;
}

.search-input-wrapper .search-btn:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.search-history {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  margin-top: 10px;
  z-index: 100;
  padding: 15px;
  text-align: left;
}

.search-history h3 {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  color: #666;
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: #f0f0f0;
}

.remove-btn {
  background: none;
  border: none;
  color: #999;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.remove-btn:hover {
  background-color: #e5e7eb;
  color: #333;
}

.clear-btn {
  margin-top: 10px;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 5px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background-color: #f0f0f0;
}

.search-error {
  margin-top: 15px;
  color: #ef4444;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .search-header h1 {
    font-size: 2rem;
  }
  
  .search-header p {
    font-size: 1rem;
  }
  
  .search-container {
    padding: 0 10px;
  }
  
  .search-input-wrapper input {
    padding: 12px 15px;
  }
  
  .search-input-wrapper .search-btn {
    padding: 0 20px;
  }
}
</style>
