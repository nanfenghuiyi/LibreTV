import { defineStore } from 'pinia'

export const useSearchStore = defineStore('search', {
  state: () => ({
    searchQuery: '',
    searchResults: [],
    searchLoading: false,
    searchError: null,
    searchHistory: [],
    currentPage: 1,
    totalPages: 1
  }),
  
  getters: {
    recentSearches: (state) => state.searchHistory.slice(0, 10)
  },
  
  actions: {
    async search(query, page = 1) {
      this.searchLoading = true
      this.searchError = null
      this.currentPage = page
      
      try {
        // 实际API请求
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&page=${page}`)
        const data = await response.json()
        this.searchResults = data.results
        this.totalPages = data.totalPages
        
        // 添加到搜索历史
        this.addToHistory(query)
      } catch (error) {
        this.searchError = error.message
      } finally {
        this.searchLoading = false
      }
    },
    
    addToHistory(query) {
      // 移除已存在的相同查询
      this.searchHistory = this.searchHistory.filter(item => item !== query)
      // 添加到历史记录开头
      this.searchHistory.unshift(query)
      // 限制历史记录数量
      if (this.searchHistory.length > 50) {
        this.searchHistory = this.searchHistory.slice(0, 50)
      }
      // 保存到本地存储
      localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory))
    },
    
    clearHistory() {
      this.searchHistory = []
      localStorage.removeItem('searchHistory')
    },
    
    loadHistory() {
      const savedHistory = localStorage.getItem('searchHistory')
      if (savedHistory) {
        this.searchHistory = JSON.parse(savedHistory)
      }
    }
  }
})
