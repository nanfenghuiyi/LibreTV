<template>
  <div class="bg-[#1a1a1a] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer flex flex-col h-full" @click="$emit('click')">
    <div class="relative aspect-[3/4] overflow-hidden group">
      <img :src="video.vod_pic" alt="cover" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" @error="handleImageError">
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
      <div class="absolute bottom-2 left-2 right-2">
        <span class="text-xs bg-pink-600 text-white px-2 py-1 rounded">{{ video.type_name || '视频' }}</span>
        <span v-if="video.vod_remarks" class="text-xs bg-blue-600 text-white px-2 py-1 rounded ml-1">{{ video.vod_remarks }}</span>
      </div>
    </div>
    <div class="p-3 flex flex-col flex-1">
      <h3 class="text-white font-medium truncate mb-1" :title="video.vod_name">{{ video.vod_name }}</h3>
      <div class="flex justify-between items-center text-xs text-gray-400 mt-auto">
        <span>{{ video.vod_year || '未知' }}</span>
        <span class="border border-gray-600 px-1 rounded">{{ video.source_name }}</span>
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
