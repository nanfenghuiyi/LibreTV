<template>
  <div class="page-bg text-white">
    <!-- 历史记录按钮 -->
    <div class="fixed top-4 left-4 z-10">
      <button @click="toggleHistory"
        class="bg-[#222] hover:bg-[#333] border border-[#333] hover:border-white rounded-lg px-3 py-1.5 transition-colors"
        aria-label="观看历史">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </button>
    </div>

    <!-- 设置按钮 -->
    <div class="fixed top-4 right-4 z-10">
      <button @click="toggleSettings"
        class="bg-[#222] hover:bg-[#333] border border-[#333] hover:border-white rounded-lg px-3 py-1.5 transition-colors"
        aria-label="打开设置">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z">
          </path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </button>
    </div>

    <main class="container mx-auto px-4 py-8 flex flex-col h-screen">
      <div class="flex-1 flex flex-col">
        <!-- 网站标志和口号 -->
        <header class="text-center mb-2">
          <div class="flex justify-center items-center mb-4">
            <router-link to="/" class="flex items-center">
              <svg class="w-10 h-10 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z">
                </path>
              </svg>
              <h1 class="text-5xl font-bold gradient-text">LibreTV</h1>
            </router-link>
          </div>
          <p class="text-gray-400 mb-8">自由观影，畅享精彩</p>
        </header>

        <!-- 路由视图 -->
        <router-view />
      </div>
    </main>

    <!-- 页脚区域 -->
    <footer class="footer mt-8 py-6 border-t border-[#333] bg-[#0a0a0a]">
      <div class="container mx-auto px-4">
        <div class="flex flex-col md:flex-row justify-between items-center">
          <div class="mb-4 md:mb-0">
            <div class="flex items-center justify-center md:justify-start">
              <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z">
                </path>
              </svg>
              <span class="gradient-text font-bold">LibreTV</span>
            </div>
            <p class="text-gray-500 text-sm mt-2 text-center md:text-left">© 2025 LibreTV - 自由观影，畅享精彩</p>
          </div>

          <div class="text-center md:text-right">
            <p class="text-gray-500 text-sm max-w-md">
              免责声明：本站仅为视频搜索工具，不存储、上传或分发任何视频内容。
              所有视频均来自第三方API接口。如有侵权，请联系相关内容提供方。
            </p>
            <div class="mt-2 flex justify-center md:justify-end space-x-4">
              <a href="/about" class="text-gray-400 hover:text-white text-sm transition-colors">关于我们</a>
              <a href="/about" class="text-gray-400 hover:text-white text-sm transition-colors">隐私政策</a>
              <a href="https://www.msf.hk/zh-hant/donate/general?type=one-off" target="_blank" rel="noopener"
                class="text-blue-400 hover:text-blue-300 text-sm transition-colors">捐赠</a>
            </div>
          </div>
        </div>
      </div>
    </footer>

    <!-- 组件引入 -->
    <HistoryPanel ref="historyPanel" />
    <SettingsPanel ref="settingsPanel" />
    <Modal ref="modal" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import HistoryPanel from './components/HistoryPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import Modal from './components/Modal.vue'

// 面板引用
const historyPanel = ref(null)
const settingsPanel = ref(null)
const modal = ref(null)

// 方法
const toggleHistory = () => {
  if (historyPanel.value) {
    historyPanel.value.toggle()
  }
}

const toggleSettings = () => {
  if (settingsPanel.value) {
    settingsPanel.value.toggle()
  }
}
</script>
