<template>
  <div class="bg-[#1a1a1a] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer flex flex-col h-full" @click="$emit('click')">
    <div class="relative aspect-[3/4] overflow-hidden group shadow-inner">
      <img :src="video.vod_pic" alt="cover" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" @error="handleImageError">
      
      <!-- Badges/Tags -->
      <div class="absolute inset-0 pointer-events-none p-1.5 flex flex-col justify-between">
          <div class="flex justify-between items-start gap-1">
              <span class="text-[10px] sm:text-xs bg-black/60 backdrop-blur-md text-gray-200 px-1.5 py-0.5 rounded-sm border border-white/10">{{ video.type_name || '视频' }}</span>
              <span class="text-[10px] sm:text-xs bg-white text-black font-bold px-1.5 py-0.5 rounded-sm shadow-lg">{{ video.source_name }}</span>
          </div>
          
          <div class="flex flex-wrap items-end gap-1">
              <span v-if="video.vod_remarks" class="text-[10px] sm:text-xs bg-pink-600/90 text-white px-1.5 py-0.5 rounded-sm backdrop-blur-sm shadow-lg max-w-full truncate">
                {{ video.vod_remarks }}
              </span>
          </div>
      </div>

      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
    </div>
    <div class="p-2 sm:p-3 flex flex-col flex-1">
      <h3 class="text-white text-sm sm:text-base font-medium truncate mb-1 group-hover:text-pink-500 transition-colors" :title="video.vod_name">
        {{ video.vod_name }}
      </h3>
      <div class="flex items-center text-[10px] sm:text-xs text-gray-500">
        <span class="flex items-center">
            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path></svg>
            {{ video.vod_year || '2025' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  video: any
}>();

const handleImageError = (e: Event) => {
  (e.target as HTMLImageElement).src = '/image/logo.png'; // Fallback
};
</script>
