<template>
  <div class="fixed left-0 top-0 h-full bg-[#111] border-r border-[#333] z-40 transform transition-transform duration-300 w-80 flex flex-col shadow-2xl"
        :class="show ? 'translate-x-0' : '-translate-x-full'">
        
        <div class="flex justify-between items-center p-6 border-b border-[#333]">
            <button @click="$emit('close')" class="text-gray-400 hover:text-white transition-colors bg-[#222] p-1 rounded-full w-8 h-8 flex items-center justify-center">&times;</button>
            <h3 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">观看历史</h3>
            <div class="w-8 h-8"></div>
        </div>

        <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <div v-if="history.length === 0" class="text-center text-gray-500 py-8 italic">暂无观看记录</div>
            
            <div v-for="(item, idx) in history" :key="idx" class="bg-[#1a1a1a] p-3 rounded-lg border border-[#333] flex gap-3 cursor-pointer hover:bg-[#222] hover:border-[#444] transition-all" @click="playHistory(item)">
                <img :src="item.cover" class="w-16 h-24 object-cover rounded bg-gray-800 flex-shrink-0 shadow-md" />
                <div class="flex-1 min-w-0 flex flex-col">
                    <div class="text-white text-sm font-bold truncate">{{ item.title }}</div>
                    <div class="text-blue-400 text-[10px] mt-1 font-medium">观看至: {{ item.progress || '0%' }}</div>
                    <div class="text-gray-500 text-[10px] mt-auto flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        {{ item.time }}
                    </div>
                </div>
            </div>
        </div>

        <div class="p-4 bg-[#111] border-t border-[#333]">
            <button @click="clearHistory" class="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-lg py-2.5 text-sm font-bold shadow-lg hover:opacity-90 transition-opacity">清空历史记录</button>
        </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { navigateTo } from '#app';
const props = defineProps<{ show: boolean }>();
const emit = defineEmits(['close']);

const { history, loadHistory, clearHistory: clearAllHistory } = usePlayHistory();

const clearHistory = () => {
    if (confirm('确定要清空观看历史吗？')) {
        clearAllHistory();
    }
};

const playHistory = (item: any) => {
    navigateTo({ 
        path: '/play', 
        query: { 
            url: item.url, 
            title: item.title,
            id: item.id,
            cover: item.cover,
            episodeIndex: item.episodeIndex,
            currentTime: item.currentTime
        } 
    });
};

onMounted(() => {
    loadHistory();
});
</script>
