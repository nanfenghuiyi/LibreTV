import { defineStore } from 'pinia'

export const useHistoryStore = defineStore('history', {
  state: () => ({
    watchHistory: [],
    maxHistoryItems: 100
  }),
  
  getters: {
    recentHistory: (state) => state.watchHistory.slice(0, 20),
    historyCount: (state) => state.watchHistory.length
  },
  
  actions: {
    addToHistory(item) {
      // 移除已存在的相同项目
      this.watchHistory = this.watchHistory.filter(historyItem => 
        historyItem.id !== item.id || historyItem.source !== item.source
      )
      
      // 添加到历史记录开头
      this.watchHistory.unshift({
        ...item,
        watchedAt: new Date().toISOString()
      })
      
      // 限制历史记录数量
      if (this.watchHistory.length > this.maxHistoryItems) {
        this.watchHistory = this.watchHistory.slice(0, this.maxHistoryItems)
      }
      
      // 保存到本地存储
      this.saveHistory()
    },
    
    removeFromHistory(itemId, source) {
      this.watchHistory = this.watchHistory.filter(item => 
        !(item.id === itemId && item.source === source)
      )
      this.saveHistory()
    },
    
    clearHistory() {
      this.watchHistory = []
      this.saveHistory()
    },
    
    saveHistory() {
      localStorage.setItem('watchHistory', JSON.stringify(this.watchHistory))
    },
    
    loadHistory() {
      const savedHistory = localStorage.getItem('watchHistory')
      if (savedHistory) {
        this.watchHistory = JSON.parse(savedHistory)
      }
    },
    
    setMaxHistoryItems(count) {
      this.maxHistoryItems = count
      // 如果当前历史记录超过新限制，截取
      if (this.watchHistory.length > count) {
        this.watchHistory = this.watchHistory.slice(0, count)
        this.saveHistory()
      }
    }
  }
})
