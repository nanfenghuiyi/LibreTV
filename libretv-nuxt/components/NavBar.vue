<!--
 * @Author: zhuzihao zhuzihao@idmakers.cn
 * @Date: 2026-01-15 10:02:38
 * @LastEditors: zhuzihao zhuzihao@idmakers.cn
 * @LastEditTime: 2026-01-15 10:55:50
 * @FilePath: \LibreTV\libretv-nuxt\components\NavBar.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<template>
  <nav 
    class="flex flex-col items-center justify-center transition-all duration-500 ease-in-out px-4 py-8"
  >
    <div class="text-center mb-6 sm:mb-8">
      <NuxtLink to="/" class="flex items-center justify-center mb-4 group" @click="handleHomeClick">
         <img src="/image/logo.png" alt="Logo" class="w-8 h-8 sm:w-10 sm:h-10 mr-2 group-hover:scale-110 transition-transform" />
         <h1 class="text-3xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
           LibreTV
         </h1>
      </NuxtLink>
      <p class="text-xs sm:text-base text-gray-400">自由观影，畅享精彩</p>
    </div>

    <div class="w-full max-w-2xl px-2 sm:px-4">
      <div class="flex items-stretch h-12 sm:h-14 shadow-lg rounded-lg overflow-hidden border border-[#333]">
        <NuxtLink to="/" class="w-16 sm:w-24 flex items-center justify-center bg-white text-black text-sm sm:text-base font-medium hover:bg-gray-200 transition-colors" @click="handleHomeClick">
           <span class="hidden sm:inline">首页</span>
           <svg class="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
        </NuxtLink>
        <div class="flex-1 relative">
            <input
                v-model="searchQuery"
                @keyup.enter="handleSearch"
                type="text"
                class="w-full h-full bg-[#111] text-white px-4 sm:px-6 focus:outline-none placeholder-gray-500 text-sm sm:text-base"
                placeholder="搜索..."
            />
            <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <button @click="handleSearch" class="w-16 sm:w-24 flex items-center justify-center bg-white text-black text-sm sm:text-base font-medium hover:bg-gray-200 transition-colors">
          <span class="hidden sm:inline">搜索</span>
          <svg class="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </button>
      </div>

      <!-- Recent Searches -->
      <div v-if="history && history.length > 0" class="mt-4 flex flex-wrap gap-2 animate-fade-in">
          <div class="w-full flex justify-between items-center mb-1">
              <span class="text-xs text-gray-500">最近搜索:</span>
              <button @click="clearHistory" class="text-xs text-gray-500 hover:text-white transition-colors">清除历史</button>
          </div>
          <div 
              v-for="item in history" 
              :key="item.text"
              class="group flex items-center bg-[#222] hover:bg-[#333] border border-[#333] rounded-full px-3 py-1 transition-all cursor-pointer"
              @click="handleHistoryClick(item.text)"
          >
              <span class="text-xs text-gray-300 group-hover:text-white">{{ item.text }}</span>
              <button 
                @click.stop="removeHistory(item.text)" 
                class="ml-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
          </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
const searchQuery = ref('');
const isInputFocused = ref(false);
const route = useRoute();
const router = useRouter();
const { history, removeHistory, clearHistory } = useSearchHistory();

// Set search query from URL if present
watch(() => route.query.s, (val) => {
    searchQuery.value = (val as string) || '';
}, { immediate: true });

const { clearSearch: clearGlobalSearch } = useSearchState();

const handleHomeClick = () => {
    clearGlobalSearch();
    searchQuery.value = '';
};

const isHomePage = computed(() => {
    return route.path === '/' && !route.query.s;
});

const handleSearch = () => {
    if (!searchQuery.value.trim()) return;
    router.push({ 
        path: '/', 
        query: { 
            s: searchQuery.value.trim(),
            t: Date.now().toString() // Force reactive update for identical queries
        } 
    });
};

const handleHistoryClick = (text: string) => {
    searchQuery.value = text;
    handleSearch();
};
</script>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
