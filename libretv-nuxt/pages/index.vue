<!--
 * @Author: zhuzihao zhuzihao@idmakers.cn
 * @Date: 2026-01-15 10:03:11
 * @LastEditors: zhuzihao zhuzihao@idmakers.cn
 * @LastEditTime: 2026-01-17 16:26:13
 * @FilePath: \LibreTV\libretv-nuxt\pages\index.vue
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
<template>
  <div class="h-full">
    <div v-if="loading" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="w-10 h-10 border-4 border-pink-500 rounded-full border-t-transparent animate-spin"></div>
    </div>

    <!-- Douban / Recommendations Area -->
    <!-- Douban / Recommendations Area -->
    <div v-if="!hasResults" class="my-8">
        <DoubanRecommend @select="performSearch" />
    </div>

    <!-- Search Results -->
    <div v-else class="flex flex-col gap-4">
        <div class="flex items-center justify-between px-2">
            <h2 class="text-lg font-semibold text-white">搜索结果</h2>
            <div class="text-sm text-gray-400">
                共找到 <span class="font-medium text-pink-500">{{ results.length }}</span> 个结果
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            <VideoCard 
                v-for="(item, index) in results" 
                :key="item.vod_id + '_' + item.source_code + index" 
                :video="item" 
                @click="openDetail(item)"
            />
        </div>
    </div>

    <!-- Detail Modal -->
    <DetailModal 
        v-if="showDetail" 
        :show="showDetail" 
        :video="currentDetail" 
        @close="showDetail = false"
        @play="handlePlay"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
    keepalive: true
});

import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { navigateTo } from '#app';
const route = useRoute();
const router = useRouter();
const { handleAggregatedSearch, getDetail } = useVideoApi();
const { addHistory } = useSearchHistory();
const { 
    results, 
    searchPerformed, 
    lastQuery: lastSearchQuery, 
    loading, 
    clearSearch: clearState 
} = useSearchState();

const showDetail = ref(false);
const currentDetail = ref<any>({});

const hasResults = computed(() => results.value.length > 0);

const performSearch = async (query: string) => {
    if (!query) return;
    loading.value = true;
    searchPerformed.value = true;
    lastSearchQuery.value = query;
    addHistory(query); 
    try {
        const data = await handleAggregatedSearch(query);
        results.value = data || [];
    } catch (e) {
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const clearSearch = () => {
    clearState();
    router.push({ path: '/' }); 
};

const openDetail = async (item: any) => {
    loading.value = true;
    try {
        const detail = await getDetail(item.vod_id, item.source_code);
        currentDetail.value = detail;
        showDetail.value = true;
    } catch (e) {
        alert('获取详情失败');
    } finally {
        loading.value = false;
    }
};

const handlePlay = (url: string) => {
    // Find episode index if possible
    const epIndex = currentDetail.value.episodes?.findIndex(ep => ep.includes(url)) ?? 0;
    
    navigateTo({
        path: '/play',
        query: { 
            url, 
            title: currentDetail.value.vod_name,
            id: currentDetail.value.vod_id,
            source: currentDetail.value.source_code,
            index: epIndex.toString()
        }
    });
};

// Initial search from URL
watch(() => route.query, (newQuery) => {
    const queryStr = newQuery.s as string;
    if (queryStr) {
        // Trigger search if:
        // 1. It's a new query string
        // 2. Or it's the same query but a new timestamp (forced refresh)
        // 3. Or current results are empty
        if (lastSearchQuery.value !== queryStr || newQuery.t || results.value.length === 0) {
            performSearch(queryStr);
        }
    } else {
        // No query in URL
    }
}, { immediate: true, deep: true });
</script>
