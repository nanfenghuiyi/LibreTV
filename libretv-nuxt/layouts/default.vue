<template>
  <div class="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col">
    <div class="fixed top-4 left-4 z-10">
        <button @click="toggleHistory" class="bg-[#222] hover:bg-[#333] border border-[#333] rounded-lg px-3 py-1.5 transition-colors">
            <!-- History Icon -->
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </button>
    </div>
    <div class="fixed top-4 right-4 z-10">
        <button @click="toggleSettings" class="bg-[#222] hover:bg-[#333] border border-[#333] rounded-lg px-3 py-1.5 transition-colors">
            <!-- Settings Icon -->
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
    </div>
    
    <NavBar :class="{'flex-1': isLandingPage}" />

    <main class="container mx-auto px-4 pb-20">
      <slot />
    </main>

    <SettingsPanel :show="showSettings" @close="showSettings = false" />
    <HistoryPanel :show="showHistory" @close="showHistory = false" />
    <PasswordModal />

    <footer class="border-t border-[#333] py-6 mt-10 bg-[#000]">
        <div class="container mx-auto px-4 text-center text-gray-500 text-sm">
            <p>© 2025 LibreTV - 自由观影，畅享精彩</p>
            <p class="mt-2">免责声明：本站仅为视频搜索工具，不存储任何内容。</p>
        </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const { showSettings, showHistory, toggleSettings, toggleHistory } = useUI();
const route = useRoute();

const isLandingPage = computed(() => {
    return route.path === '/' && !route.query.s;
});
</script>
