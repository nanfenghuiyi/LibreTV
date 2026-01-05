<template>
  <div class="history-component">
    <div class="history-header">
      <h2>观看历史</h2>
      <button
        v-if="watchHistory.length > 0"
        @click="showClearConfirm = true"
        class="clear-btn"
      >
        清空历史
      </button>
    </div>
    
    <div v-if="loading" class="history-loading">
      加载历史记录中...
    </div>
    
    <div v-else-if="watchHistory.length === 0" class="history-empty">
      <img src="/image/nomedia.png" alt="暂无历史记录" class="empty-img" />
      <p>暂无观看历史记录</p>
      <p class="empty-hint">观看视频后，历史记录将显示在这里</p>
    </div>
    
    <div v-else class="history-content">
      <div class="history-filters">
        <div class="filter-group">
          <label for="historySort">排序方式：</label>
          <select v-model="sortBy" @change="handleSortChange" id="historySort">
            <option value="time">按时间排序</option>
            <option value="title">按标题排序</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label for="historyLimit">显示数量：</label>
          <select v-model="limit" @change="handleLimitChange" id="historyLimit">
            <option value="10">10条</option>
            <option value="20">20条</option>
            <option value="50">50条</option>
            <option value="all">全部</option>
          </select>
        </div>
      </div>
      
      <div class="history-list">
        <div
          v-for="item in displayedHistory"
          :key="`${item.id}-${item.source}`"
          class="history-item"
        >
          <div class="history-poster" @click="playVideo(item)">
            <img :src="item.poster || '/image/nomedia.png'" :alt="item.title" />
            <div class="play-overlay">
              <span class="play-icon">▶</span>
            </div>
          </div>
          
          <div class="history-info">
            <h3 @click="playVideo(item)" class="history-title">{{ item.title }}</h3>
            <p class="history-meta">
              <span class="history-source">{{ item.source || '未知来源' }}</span>
              <span class="history-date">{{ formatDate(item.watchedAt) }}</span>
            </p>
          </div>
          
          <button
            @click="removeHistoryItem(item)"
            class="remove-btn"
            title="删除此记录"
          >
            ×
          </button>
        </div>
      </div>
    </div>
    
    <!-- 清空确认对话框 -->
    <div v-if="showClearConfirm" class="confirm-dialog">
      <div class="confirm-content">
        <h3>确认清空</h3>
        <p>您确定要清空所有观看历史记录吗？此操作不可恢复。</p>
        <div class="confirm-actions">
          <button @click="showClearConfirm = false" class="cancel-btn">取消</button>
          <button @click="clearHistory" class="confirm-btn">确认清空</button>
        </div>
      </div>
      <div @click="showClearConfirm = false" class="confirm-overlay"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '../store/historyStore'

const router = useRouter()
const historyStore = useHistoryStore()

// State
const loading = ref(false)
const showClearConfirm = ref(false)
const sortBy = ref('time')
const limit = ref('10')

// Computed
const watchHistory = computed(() => historyStore.watchHistory)

const displayedHistory = computed(() => {
  let filtered = [...watchHistory.value]
  
  // 排序
  if (sortBy.value === 'time') {
    filtered.sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))
  } else if (sortBy.value === 'title') {
    filtered.sort((a, b) => a.title.localeCompare(b.title))
  }
  
  // 限制数量
  if (limit.value !== 'all') {
    filtered = filtered.slice(0, parseInt(limit.value))
  }
  
  return filtered
})

// Methods
const loadHistory = () => {
  loading.value = true
  try {
    historyStore.loadHistory()
  } finally {
    loading.value = false
  }
}

const playVideo = (item) => {
  // 跳转到播放页面
  router.push({
    name: 'Watch',
    params: {
      videoId: item.id,
      videoTitle: item.title,
      videoUrl: item.url,
      source: item.source
    },
    query: {
      poster: item.poster
    }
  })
}

const removeHistoryItem = (item) => {
  historyStore.removeFromHistory(item.id, item.source)
}

const clearHistory = () => {
  historyStore.clearHistory()
  showClearConfirm.value = false
}

const handleSortChange = () => {
  // 排序方式变更时的处理逻辑
}

const handleLimitChange = () => {
  // 显示数量变更时的处理逻辑
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = now - date
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    // 今天
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    // 昨天
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffDays < 7) {
    // 一周内
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${weekdays[date.getDay()]} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    // 一周前
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
}

// Lifecycle hooks
onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.history-component {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 20px;
  margin-bottom: 20px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.history-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.3rem;
}

.clear-btn {
  padding: 6px 14px;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background-color: #b91c1c;
}

.history-loading {
  text-align: center;
  padding: 40px 0;
  color: #666;
}

.history-empty {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.empty-img {
  width: 120px;
  height: 120px;
  opacity: 0.5;
  margin-bottom: 15px;
}

.empty-hint {
  font-size: 0.9rem;
  color: #999;
  margin-top: 10px;
}

.history-content {
  margin-bottom: 10px;
}

.history-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.filter-group select {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background-color: white;
  font-size: 0.9rem;
  color: #333;
}

.filter-group select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s;
  position: relative;
}

.history-item:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}

.history-poster {
  width: 80px;
  height: 100px;
  flex-shrink: 0;
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

.history-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.history-item:hover .history-poster img {
  transform: scale(1.05);
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.history-item:hover .play-overlay {
  opacity: 1;
}

.play-icon {
  color: white;
  font-size: 2rem;
  font-weight: bold;
}

.history-info {
  flex: 1;
  padding: 12px;
  min-width: 0;
}

.history-title {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #333;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
}

.history-title:hover {
  color: #2563eb;
}

.history-meta {
  margin: 0;
  font-size: 0.8rem;
  color: #999;
  display: flex;
  gap: 15px;
}

.remove-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
  z-index: 2;
}

.history-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background-color: #dc2626;
}

/* 确认对话框 */
.confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.confirm-content {
  background-color: white;
  border-radius: 8px;
  padding: 25px;
  width: 90%;
  max-width: 400px;
  position: relative;
  z-index: 1001;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.confirm-content h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.confirm-content p {
  margin: 0 0 20px 0;
  color: #666;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
}

.cancel-btn, .confirm-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: #e5e7eb;
  color: #333;
}

.cancel-btn:hover {
  background-color: #d1d5db;
}

.confirm-btn {
  background-color: #dc2626;
  color: white;
}

.confirm-btn:hover {
  background-color: #b91c1c;
}

@media (max-width: 768px) {
  .history-component {
    padding: 15px;
  }
  
  .history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .history-filters {
    flex-direction: column;
    gap: 12px;
  }
  
  .history-poster {
    width: 70px;
    height: 90px;
  }
  
  .history-info {
    padding: 10px;
  }
  
  .history-title {
    font-size: 0.95rem;
  }
  
  .history-meta {
    font-size: 0.75rem;
    flex-direction: column;
    gap: 5px;
  }
}
</style>
