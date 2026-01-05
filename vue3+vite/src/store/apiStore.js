import { defineStore } from 'pinia'

export const useApiStore = defineStore('api', {
  state: () => ({
    apis: [],
    customApis: [],
    selectedApi: null,
    apiLoading: false,
    apiError: null
  }),
  
  getters: {
    allApis: (state) => [...state.apis, ...state.customApis],
    isApiAvailable: (state) => state.apis.length > 0 || state.customApis.length > 0
  },
  
  actions: {
    async fetchApis() {
      this.apiLoading = true
      this.apiError = null
      try {
        // 实际API请求
        const response = await fetch('/api/apis')
        this.apis = await response.json()
      } catch (error) {
        this.apiError = error.message
      } finally {
        this.apiLoading = false
      }
    },
    
    addCustomApi(api) {
      this.customApis.push(api)
      // 保存到本地存储
      localStorage.setItem('customApis', JSON.stringify(this.customApis))
    },
    
    removeCustomApi(apiId) {
      this.customApis = this.customApis.filter(api => api.id !== apiId)
      // 保存到本地存储
      localStorage.setItem('customApis', JSON.stringify(this.customApis))
    },
    
    selectApi(apiId) {
      this.selectedApi = this.allApis.find(api => api.id === apiId)
    },
    
    loadCustomApis() {
      const savedApis = localStorage.getItem('customApis')
      if (savedApis) {
        this.customApis = JSON.parse(savedApis)
      }
    }
  }
})
