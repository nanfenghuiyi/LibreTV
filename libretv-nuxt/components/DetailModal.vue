<template>
  <div v-if="show" class="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-[#111] p-6 rounded-lg w-full max-w-4xl border border-[#333] max-h-[90vh] flex flex-col relative animate-fade-in">
        <button @click="$emit('close')" class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
        
        <div class="flex flex-col md:flex-row gap-6 overflow-y-auto">
            <!-- Cover -->
            <div class="w-full md:w-1/3 flex-shrink-0">
                <div class="aspect-[3/4] rounded overflow-hidden relative group">
                    <img :src="video.vod_pic" class="w-full h-full object-cover" @error="handleImageError" />
                     <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button @click="playVideo(video.episodes[0])" class="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 transition-transform hover:scale-110">
                            <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Info -->
            <div class="flex-1 text-gray-300">
                <h2 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mb-4">{{ video.vod_name }}</h2>
                
                <div class="space-y-2 text-sm mb-6">
                    <p><span class="text-gray-500">类型:</span> {{ video.type_name }}</p>
                    <p><span class="text-gray-500">地区:</span> {{ video.vod_area }}</p>
                    <p><span class="text-gray-500">年份:</span> {{ video.vod_year }}</p>
                    <p><span class="text-gray-500">主演:</span> {{ video.vod_actor }}</p>
                    <p><span class="text-gray-500">简介:</span> <span v-html="video.vod_content"></span></p>
                </div>

                <!-- Episodes -->
                <div v-if="video.episodes && video.episodes.length > 0">
                    <h3 class="text-white font-bold mb-2">选集播放</h3>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        <button 
                            v-for="(ep, index) in video.episodes" 
                            :key="index"
                            @click="playVideo(ep)"
                            class="bg-[#222] hover:bg-pink-600 text-gray-300 hover:text-white py-2 px-1 rounded text-xs truncate transition-colors border border-[#333]"
                        >
                            {{ isUrl(ep) ? `第${index+1}集` : ep.split('$')[0] }}
                        </button>
                    </div>
                </div>
                <div v-else class="text-red-500 mt-4">
                    暂无播放源
                </div>
            </div>
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

const isUrl = (str: string) => str.startsWith('http');

const playVideo = (ep: string) => {
    // If ep string contains title$url, extract url
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
