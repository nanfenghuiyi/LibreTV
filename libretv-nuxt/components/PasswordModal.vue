<template>
  <div v-if="!isAuthenticated" class="fixed inset-0 bg-black flex items-center justify-center z-[100]">
      <div class="bg-[#111] p-8 rounded-lg border border-[#333] w-full max-w-md text-center">
          <h2 class="text-2xl font-bold text-white mb-6">请输入访问密码</h2>
          <div class="mb-6">
              <input 
                v-model="password" 
                type="password" 
                placeholder="密码" 
                class="w-full bg-[#1a1a1a] border border-[#333] rounded px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors"
                @keyup.enter="handleLogin"
              />
              <p class="text-xs text-gray-500 mt-2 text-left">默认密码可能是 111111</p>
          </div>
          <button 
            @click="handleLogin" 
            class="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold py-3 rounded hover:opacity-90 transition-opacity"
            :disabled="!password"
          >
            进入 LibreTV
          </button>
      </div>
  </div>
</template>

<script setup lang="ts">
const password = ref('');
const { setPassword, isAuthenticated } = useAuth();

// Removed manual checkAuth as useCookie handles state initialization
// onMounted(() => { });

const handleLogin = () => {
    if (password.value) {
        setPassword(password.value);
        // Refresh page or trigger re-fetch?
        // Since useDouban fetches onMounted, and this modal blocks the view...
        // Ideally we reload to trigger fetches, OR we emit an event.
        // Simple way: reload, but that might clear state if persistence isn't perfect.
        // Better: just let the state update. If components watch `isAuthenticated` or retry...
        // Actually, DoubanRecommend fetches onMounted. If we are just mounting App, DoubanRecommend might have already tried and failed.
        // We should trigger a reload or use a key on the layout.
        if (isAuthenticated.value) {
           location.reload(); 
        }
    }
};
</script>
