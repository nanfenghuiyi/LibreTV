<template>
  <div class="douban-component">
    <div class="douban-header">
      <h2>豆瓣热门推荐</h2>
      <div class="douban-tabs">
        <button
          @click="activeTab = 'movie'"
          :class="{ 'active': activeTab === 'movie' }"
          class="tab-btn"
        >
          电影
        </button>
        <button
          @click="activeTab = 'tv'"
          :class="{ 'active': activeTab === 'tv' }"
          class="tab-btn"
        >
          电视剧
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="douban-loading">
      加载推荐内容中...
    </div>
    
    <div v-else-if="error" class="douban-error">
      {{ error }}
      <button @click="fetchRecommendations" class="retry-btn">重试</button>
    </div>
    
    <div v-else>
      <div class="douban-content">
        <div v-if="activeTab === 'movie'" class="douban-movies">
          <div
            v-for="movie in movies"
            :key="movie.id"
            class="douban-item"
            @click="handleItemClick(movie)"
          >
            <div class="douban-poster">
              <img :src="movie.cover" :alt="movie.title" :title="movie.title" />
              <div class="douban-rating">
                <span class="rating-star">★</span>
                <span class="rating-score">{{ movie.rate || '暂无评分' }}</span>
              </div>
            </div>
            <div class="douban-info">
              <h3 class="douban-title">{{ movie.title }}</h3>
            </div>
          </div>
        </div>
        
        <div v-else class="douban-tvs">
          <div
            v-for="tv in tvs"
            :key="tv.id"
            class="douban-item"
            @click="handleItemClick(tv)"
          >
            <div class="douban-poster">
              <img :src="tv.cover" :alt="tv.title" :title="tv.title" />
              <div class="douban-rating">
                <span class="rating-star">★</span>
                <span class="rating-score">{{ tv.rate || '暂无评分' }}</span>
              </div>
            </div>
            <div class="douban-info">
              <h3 class="douban-title">{{ tv.title }}</h3>
            </div>
          </div>
        </div>
      </div>
      
      <div class="douban-more">
        <button @click="loadMore" :disabled="loadingMore" class="more-btn">
          <span v-if="loadingMore">加载中...</span>
          <span v-else>加载更多</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSearchStore } from '../store/searchStore'

const searchStore = useSearchStore()

// State
const activeTab = ref('movie')
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const movies = ref([])
const tvs = ref([])
const page = ref(1)
const hasMore = ref(true)

// Methods
const fetchRecommendations = async (loadMore = false) => {
  if (loading.value || (loadingMore.value && loadMore)) return
  
  if (loadMore) {
    loadingMore.value = true
    page.value++
  } else {
    loading.value = true
    page.value = 1
  }
  
  error.value = ''
  
  try {
    // 计算开始索引
    const page_start = (page.value - 1) * 20
    
    // 实际API请求 - 使用豆瓣API的参数名
    const response = await fetch(`/api/douban/${activeTab.value}?page_limit=20&page_start=${page_start}`)
    const data = await response.json()
    
    // 豆瓣API返回的是subjects而不是items
    const items = data.subjects || []
    
    if (loadMore) {
      if (activeTab.value === 'movie') {
        movies.value = [...movies.value, ...items]
      } else {
        tvs.value = [...tvs.value, ...items]
      }
    } else {
      if (activeTab.value === 'movie') {
        movies.value = items
      } else {
        tvs.value = items
      }
    }
    
    // 如果返回的项目数量小于请求的数量，说明没有更多数据了
    hasMore.value = items.length === 20
  } catch (err) {
    error.value = `加载推荐内容失败: ${err.message}`
    if (loadMore) {
      page.value--
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const handleItemClick = (item) => {
  // 点击推荐项，执行搜索
  searchStore.search(item.title)
}

const loadMore = () => {
  if (hasMore.value) {
    fetchRecommendations(true)
  }
}

// Mock data generation
const generateMockData = (type, loadMore = false) => {
  const items = []
  const startIndex = loadMore ? (page.value - 1) * 20 : 0
  const limit = 20
  
  for (let i = startIndex; i < startIndex + limit; i++) {
    const item = {
      id: `${type}-${i + 1}`,
      title: type === 'movie' ? `热门电影 ${i + 1}` : `热门电视剧 ${i + 1}`,
      subtitle: type === 'movie' ? `Movie Subtitle ${i + 1}` : `TV Series Subtitle ${i + 1}`,
      poster: `/image/nomedia.png`, // 使用默认图片
      rating: (Math.random() * 2 + 8).toFixed(1), // 8.0-10.0
      genres: ['剧情', '喜剧', '动作'],
      actors: ['演员A', '演员B', '演员C', '演员D']
    }
    items.push(item)
  }
  
  return {
    items,
    hasMore: startIndex + limit < 100 // 模拟最多100条数据
  }
}

// Lifecycle hooks
onMounted(() => {
  fetchRecommendations()
})
</script>

<style scoped>
.douban-component {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 20px;
  margin-bottom: 20px;
}

.douban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.douban-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.3rem;
}

.douban-tabs {
  display: flex;
  gap: 10px;
}

.tab-btn {
  padding: 6px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background-color: white;
  color: #666;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.tab-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.tab-btn.active {
  background-color: #2563eb;
  border-color: #2563eb;
  color: white;
}

.douban-loading, .douban-error {
  text-align: center;
  padding: 40px 0;
  color: #666;
}

.douban-error {
  color: #dc2626;
}

.retry-btn {
  margin-top: 10px;
  padding: 8px 16px;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.retry-btn:hover {
  background-color: #1d4ed8;
}

.douban-content {
  margin-bottom: 20px;
}

.douban-movies, .douban-tvs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
}

.douban-item {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border-radius: 6px;
  overflow: hidden;
}

.douban-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.douban-poster {
  position: relative;
  width: 100%;
  padding-top: 140%; /* 1:1.4 宽高比 */
  overflow: hidden;
  background-color: #f3f4f6;
}

.douban-poster img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.douban-item:hover .douban-poster img {
  transform: scale(1.05);
}

.douban-rating {
  position: absolute;
  bottom: 5px;
  left: 5px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 3px;
}

.rating-star {
  color: #ffc107;
}

.rating-score {
  font-weight: bold;
}

.douban-info {
  padding: 8px;
}

.douban-title {
  margin: 0 0 4px 0;
  font-size: 0.9rem;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.douban-subtitle {
  margin: 0 0 4px 0;
  font-size: 0.8rem;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.douban-genres {
  margin: 0 0 4px 0;
  font-size: 0.8rem;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.douban-actors {
  margin: 0;
  font-size: 0.8rem;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.douban-more {
  text-align: center;
  margin-top: 15px;
}

.more-btn {
  padding: 10px 20px;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.more-btn:hover {
  background-color: #1d4ed8;
}

.more-btn:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .douban-component {
    padding: 15px;
  }
  
  .douban-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .douban-movies, .douban-tvs {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
  
  .douban-poster {
    padding-top: 160%; /* 调整宽高比 */
  }
}

@media (max-width: 480px) {
  .douban-movies, .douban-tvs {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
  
  .douban-info {
    padding: 5px;
  }
  
  .douban-title, .douban-subtitle, .douban-genres, .douban-actors {
    font-size: 0.75rem;
  }
}
</style>
