<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" @click.self="$emit('close')">
    <div class="bg-[#111] w-[95vw] sm:w-[80vw] max-w-4xl max-h-[90vh] rounded-2xl border border-[#333] shadow-2xl overflow-hidden flex flex-col md:flex-row transform transition-all duration-300 scale-100 relative">
        <button @click="$emit('close')" class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10 md:hidden">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <!-- Sidebar: Poster -->
        <div class="w-full md:w-1/3 bg-[#0a0a0a] flex items-center justify-center p-4 group relative">
            <img :src="video.vod_pic" :alt="video.vod_name" class="w-24 md:w-full h-36 md:h-auto object-cover rounded-lg shadow-lg" @error="handleImageError" />
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg m-4 hidden md:flex">
                <button @click="playVideo(video.episodes[0])" class="bg-pink-600 hover:bg-pink-700 text-white rounded-full p-4 transition-transform hover:scale-110">
                    <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
            </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 p-4 md:p-8 overflow-y-auto flex flex-col">
            <div class="flex justify-between items-start mb-4 md:mb-6">
                <div>
                    <h2 class="text-xl md:text-3xl font-bold text-white mb-2">{{ video.vod_name }}</h2>
                    <div class="flex flex-wrap gap-2 text-[10px] md:text-sm text-gray-400">
                        <span class="px-2 py-0.5 rounded bg-pink-600/20 text-pink-500 border border-pink-500/30">{{ video.vod_class || video.type_name }}</span>
                        <span>{{ video.vod_area }}</span>
                        <span>{{ video.vod_year }}</span>
                    </div>
                </div>
                <button @click="$emit('close')" class="text-gray-500 hover:text-white transition-colors hidden md:block">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <div class="mb-4 md:mb-6">
                <h3 class="text-[10px] md:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">简介</h3>
                <p class="text-gray-400 text-xs md:text-sm leading-relaxed line-clamp-3 md:line-clamp-none" v-underline v-html="video.vod_content || '暂无简介'"></p>
            </div>

            <div v-if="video.episodes && video.episodes.length > 0" class="flex-1">
                <h3 class="text-[10px] md:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">选集播放</h3>
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    <button 
                        v-for="(ep, index) in video.episodes" 
                        :key="index"
                        @click="playVideo(ep)"
                        class="px-2 py-1.5 bg-[#1a1a1a] hover:bg-pink-600 text-gray-300 hover:text-white rounded text-[10px] md:text-xs transition-all border border-[#333] hover:border-pink-500 truncate"
                    >
                        {{ ep.split('$')[0] }}
                    </button>
                </div>
            </div>
            <div v-else class="text-red-400 text-xs italic">暂无可用播放源</div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean,
  video: any
}>();

const emit = defineEmits(['close', 'play']);

const handleImageError = (e: Event) => {
  (e.target as HTMLImageElement).src = '/image/logo.png';
};

const playVideo = (ep: string) => {
    let url = ep;
    if (ep.includes('$')) {
        url = ep.split('$')[1];
    }
    emit('play', url);
};
</script>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
</style>
