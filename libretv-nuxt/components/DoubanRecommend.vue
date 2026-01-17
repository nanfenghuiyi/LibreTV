<template>
  <div v-if="showDouban" class="mt-8">
    <div class="flex items-center justify-between mb-6">
        <div class="flex items-center space-x-4">
            <h2 class="text-xl font-bold text-white">豆瓣热门</h2>
            <div class="flex bg-[#1a1a1a] rounded-lg p-1 border border-[#333]">
                <button 
                    @click="switchType('movie')"
                    :class="currentType === 'movie' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'"
                    class="px-3 py-1 rounded text-sm transition-colors"
                >
                    电影
                </button>
                <button 
                    @click="switchType('tv')"
                    :class="currentType === 'tv' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'"
                    class="px-3 py-1 rounded text-sm transition-colors"
                >
                    电视剧
                </button>
            </div>
        </div>
        
        <button 
            @click="refresh" 
            class="px-3 py-1 bg-pink-600 text-white text-sm rounded hover:bg-pink-700 transition-colors flex items-center"
        >
            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            换一批
        </button>
    </div>

    <!-- Tags -->
    <div class="flex flex-wrap gap-2 mb-6">
        <button 
            v-for="tag in tags" 
            :key="tag"
            @click="switchTag(tag)"
            :class="currentTag === tag ? 'bg-pink-600 text-white border-white' : 'bg-[#1a1a1a] text-gray-300 border-[#333] hover:border-white'"
            class="px-3 py-1.5 rounded text-sm border transition-colors"
        >
            {{ tag }}
        </button>
    </div>

    <!-- Grid -->
    <div v-if="loading && subjects.length === 0" class="flex justify-center py-20">
        <div class="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
    
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div 
            v-for="(item, index) in subjects" 
            :key="item.id + '_' + index"
            class="bg-[#111] rounded-lg overflow-hidden cursor-pointer group hover:scale-105 transition-transform duration-300"
            @click="$emit('select', item.title)"
        >
            <div class="relative aspect-[2/3] overflow-hidden">
                <img :src="getCoverUrl(item.cover)" class="w-full h-full object-cover" loading="lazy" referrerpolicy="no-referrer" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div class="absolute bottom-1 left-2 text-xs text-yellow-400 font-bold">★ {{ item.rate }}</div>
            </div>
            <div class="p-2 text-center text-sm text-gray-200 truncate group-hover:text-pink-500">
                {{ item.title }}
            </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits(['select']);
const { currentType, currentTag, tags, subjects, loading, fetchTags, fetchSubjects, switchType, switchTag, refresh } = useDouban();
const { showDouban } = useSettings();


const { isAuthenticated } = useAuth();

const initData = async () => {
    if (tags.value.length === 0) {
        await fetchTags();
    }
    if (subjects.value.length === 0) {
        await fetchSubjects();
    }
};

onMounted(async () => {
    if (isAuthenticated.value) {
        await initData();
    }
});

watch(isAuthenticated, async (val) => {
    if (val) {
        await initData();
    }
});

const getCoverUrl = (url: string) => {
    // Proxy images to avoid referrer issues or mixed content if needed
    // But douban images usually work with referrerpolicy="no-referrer"
    // If not, use proxy: /api/proxy/encoded?auth...
    return url; 
};
</script>
