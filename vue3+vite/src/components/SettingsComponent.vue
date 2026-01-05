<template>
  <div class="settings-container">
    <h2>设置</h2>
    
    <div class="settings-section">
      <h3>外观</h3>
      <div class="setting-item">
        <label>深色模式</label>
        <div class="toggle-switch">
          <input 
            type="checkbox" 
            id="darkMode" 
            v-model="settings.darkMode"
            @change="settings.toggleDarkMode"
          >
          <label for="darkMode" class="slider"></label>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <h3>播放设置</h3>
      <div class="setting-item">
        <label>自动播放</label>
        <div class="toggle-switch">
          <input 
            type="checkbox" 
            id="autoPlay" 
            v-model="settings.autoPlay"
            @change="settings.setAutoPlay(settings.autoPlay)"
          >
          <label for="autoPlay" class="slider"></label>
        </div>
      </div>
      
      <div class="setting-item">
        <label>默认高质量播放</label>
        <div class="toggle-switch">
          <input 
            type="checkbox" 
            id="highQuality" 
            v-model="settings.highQuality"
            @change="settings.setHighQuality(settings.highQuality)"
          >
          <label for="highQuality" class="slider"></label>
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <h3>语言</h3>
      <div class="setting-item">
        <label for="language">选择语言</label>
        <select 
          id="language" 
          v-model="settings.language"
          @change="settings.setLanguage(settings.language)"
        >
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </select>
      </div>
    </div>
    
    <div class="settings-section">
      <h3>历史记录</h3>
      <div class="setting-item">
        <label for="maxHistoryItems">最大历史记录数量</label>
        <input 
          type="number" 
          id="maxHistoryItems" 
          v-model.number="settings.maxHistoryItems"
          @change="settings.saveSettings"
          min="10" 
          max="1000"
        >
      </div>
    </div>
    
    <div class="settings-section">
      <h3>API设置</h3>
      <div class="setting-item">
        <label for="apiTimeout">API超时时间 (毫秒)</label>
        <input 
          type="number" 
          id="apiTimeout" 
          v-model.number="settings.apiTimeout"
          @change="settings.setApiTimeout(settings.apiTimeout)"
          min="5000" 
          max="30000"
        >
      </div>
    </div>
    
    <div class="settings-section">
      <h3>代理设置</h3>
      <div class="setting-item">
        <label>启用代理</label>
        <div class="toggle-switch">
          <input 
            type="checkbox" 
            id="proxyEnabled" 
            v-model="settings.proxyEnabled"
            @change="settings.setProxyEnabled(settings.proxyEnabled)"
          >
          <label for="proxyEnabled" class="slider"></label>
        </div>
      </div>
      
      <div class="setting-item" v-if="settings.proxyEnabled">
        <label for="proxyUrl">代理URL</label>
        <input 
          type="text" 
          id="proxyUrl" 
          v-model="settings.proxyUrl"
          @change="settings.setProxyUrl(settings.proxyUrl)"
          placeholder="http://proxy.example.com:8080"
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSettingsStore } from '../store/settingsStore'

const settings = useSettingsStore()
</script>

<style scoped>
.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.dark-theme .settings-container {
  background-color: #333;
  color: #fff;
}

h2 {
  font-size: 24px;
  margin-bottom: 20px;
  color: #333;
  text-align: center;
}

.dark-theme h2 {
  color: #fff;
}

.settings-section {
  margin-bottom: 25px;
  padding: 15px;
  border-radius: 6px;
  background-color: #f5f5f5;
}

.dark-theme .settings-section {
  background-color: #444;
}

.settings-section h3 {
  font-size: 18px;
  margin-bottom: 15px;
  color: #555;
  border-bottom: 1px solid #ddd;
  padding-bottom: 5px;
}

.dark-theme .settings-section h3 {
  color: #ccc;
  border-bottom-color: #555;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
}

.setting-item label {
  font-size: 14px;
  color: #666;
  cursor: pointer;
}

.dark-theme .setting-item label {
  color: #aaa;
}

.setting-item input[type="number"],
.setting-item input[type="text"],
.setting-item select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background-color: #fff;
  color: #333;
  width: 150px;
}

.dark-theme .setting-item input[type="number"],
.dark-theme .setting-item input[type="text"],
.dark-theme .setting-item select {
  background-color: #555;
  color: #fff;
  border-color: #666;
}

.setting-item input[type="number"]:focus,
.setting-item input[type="text"]:focus,
.setting-item select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #007bff;
}

input:focus + .slider {
  box-shadow: 0 0 1px #007bff;
}

input:checked + .slider:before {
  transform: translateX(26px);
}
</style>