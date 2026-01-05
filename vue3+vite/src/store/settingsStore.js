import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    darkMode: false,
    autoPlay: false,
    highQuality: false,
    language: 'zh-CN',
    maxHistoryItems: 100,
    apiTimeout: 10000,
    proxyEnabled: false,
    proxyUrl: ''
  }),
  
  getters: {
    themeClass: (state) => state.darkMode ? 'dark-theme' : 'light-theme'
  },
  
  actions: {
    toggleDarkMode() {
      this.darkMode = !this.darkMode
      this.applyTheme()
      this.saveSettings()
    },
    
    setAutoPlay(enabled) {
      this.autoPlay = enabled
      this.saveSettings()
    },
    
    setHighQuality(enabled) {
      this.highQuality = enabled
      this.saveSettings()
    },
    
    setLanguage(lang) {
      this.language = lang
      this.saveSettings()
    },
    
    setApiTimeout(timeout) {
      this.apiTimeout = timeout
      this.saveSettings()
    },
    
    setProxyEnabled(enabled) {
      this.proxyEnabled = enabled
      this.saveSettings()
    },
    
    setProxyUrl(url) {
      this.proxyUrl = url
      this.saveSettings()
    },
    
    applyTheme() {
      if (this.darkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    },
    
    saveSettings() {
      localStorage.setItem('settings', JSON.stringify({
        darkMode: this.darkMode,
        autoPlay: this.autoPlay,
        highQuality: this.highQuality,
        language: this.language,
        maxHistoryItems: this.maxHistoryItems,
        apiTimeout: this.apiTimeout,
        proxyEnabled: this.proxyEnabled,
        proxyUrl: this.proxyUrl
      }))
    },
    
    loadSettings() {
      const savedSettings = localStorage.getItem('settings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        Object.assign(this, settings)
        this.applyTheme()
      }
    }
  }
})
