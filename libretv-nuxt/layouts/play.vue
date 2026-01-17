<template>
  <div class="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col">
    <!-- Player Header -->
    <header class="p-4 flex items-center border-b border-[#333] gap-2 sticky top-0 bg-[#0a0a0a] z-50">
        <div class="flex items-center min-w-0">
            <NuxtLink to="/" class="flex items-center min-w-0">
                <svg class="w-8 h-8 mr-2 text-[#ff0057]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                <h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">LibreTV</h1>
            </NuxtLink>
        </div>
        
        <div class="flex-1 text-center truncate px-4">
            <h2 id="videoTitle" class="text-lg font-semibold text-gray-200 truncate">
               <slot name="header-title"></slot>
            </h2>
        </div>

        <button @click="router.back()" class="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded-lg transition-colors flex items-center text-sm">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            返回
        </button>
    </header>

    <main class="flex-1 flex flex-col overflow-hidden">
      <slot />
    </main>

    <!-- Global Components (Settings, History) -->
    <HistoryPanel :show="showHistory" @close="toggleHistory" />
    <SettingsPanel :show="showSettings" @close="toggleSettings" />
  </div>
</template>

<script setup lang="ts">
const { showSettings, showHistory, toggleSettings, toggleHistory } = useUI();
const router = useRouter();
</script>
