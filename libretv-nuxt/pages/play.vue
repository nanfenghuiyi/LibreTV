<template>
    <div class="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
        <NuxtLayout name="play">
            <template #header-title>
                {{ title || '正在播放' }} {{ currentEpisodeTitle ? `- ${currentEpisodeTitle}` : '' }}
            </template>

            <div class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
                <!-- Main Player Area -->
                <div class="flex-1 flex flex-col p-1 sm:p-4 min-h-0">
                    <!-- Player Container -->
                    <div class="aspect-video bg-black rounded-lg overflow-hidden shadow-2xl relative group mb-2 sm:mb-4">
                        <div ref="artRef" class="w-full h-full"></div>
                    </div>

                    <!-- Player Controls/Info -->
                    <div class="flex flex-col gap-3 sm:gap-4">
                        <div class="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
                            <div class="flex items-center gap-1.5 sm:gap-2">
                                <button 
                                    @click="playPrev" 
                                    :disabled="currentIndex <= 0"
                                    class="px-2 sm:px-4 py-1.5 sm:py-2 bg-[#1a1a1a] hover:bg-[#222] disabled:opacity-50 disabled:cursor-not-allowed border border-[#333] rounded-lg transition-colors flex items-center gap-1 sm:gap-2 text-[10px] sm:text-sm shrink-0"
                                >
                                    <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                                    上一集
                                </button>
                                <button 
                                    @click="playNext" 
                                    :disabled="currentIndex >= episodes.length - 1"
                                    class="px-2 sm:px-4 py-1.5 sm:py-2 bg-[#1a1a1a] hover:bg-[#222] disabled:opacity-50 disabled:cursor-not-allowed border border-[#333] rounded-lg transition-colors flex items-center gap-1 sm:gap-2 text-[10px] sm:text-sm shrink-0"
                                >
                                    下一集
                                    <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                                </button>

                                <button 
                                    @click="copyPlayLink"
                                    class="px-2 sm:px-4 py-1.5 sm:py-2 bg-pink-600 hover:bg-pink-700 text-white border border-pink-500 rounded-lg transition-colors flex items-center gap-1 sm:gap-2 text-[10px] sm:text-sm ml-1 sm:ml-2 shrink-0"
                                >
                                    <svg class="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    下载/复制
                                </button>
                            </div>

                            <div class="flex items-center gap-4">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-gray-400">自动连播</span>
                                    <button 
                                        @click="autoplay = !autoplay"
                                        class="w-10 h-5 rounded-full transition-colors relative"
                                        :class="autoplay ? 'bg-pink-600' : 'bg-gray-700'"
                                    >
                                        <div 
                                            class="absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform"
                                            :class="autoplay ? 'translate-x-5' : 'translate-x-0'"
                                        ></div>
                                    </button>
                                </div>
                                <div class="text-xs text-gray-500">
                                    {{ currentIndex + 1 }} / {{ episodes.length }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sidebar: Episode List -->
                <div class="w-full md:w-80 bg-[#111] border-l border-[#333] flex flex-col min-h-0">
                    <!-- Resource (Site) Switcher -->
                    <div v-if="otherResourceSites.length > 0" class="p-4 border-b border-[#333] bg-[#1a1a1a]">
                        <h3 class="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">资源切换 (站点)</h3>
                        <div class="flex flex-wrap gap-2">
                            <button 
                                v-for="(siteItem, idx) in otherResourceSites" 
                                :key="idx"
                                @click="switchResource(siteItem)"
                                class="px-3 py-1.5 rounded-md text-xs transition-all border"
                                :class="siteItem.source_code === source && siteItem.vod_id === id
                                    ? 'bg-pink-600 border-pink-500 text-white'
                                    : 'bg-[#222] border-[#333] text-gray-400 hover:text-gray-200 hover:border-gray-500'"
                            >
                                {{ siteItem.source_name }}
                            </button>
                        </div>
                    </div>

                    <!-- Internal Source (Line) Switcher -->
                    <div v-if="playList.length > 1" class="p-4 border-b border-[#333] bg-[#0d0d0d]">
                        <h3 class="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">线路选择</h3>
                        <div class="flex flex-wrap gap-2">
                            <button 
                                v-for="(src, idx) in playList" 
                                :key="idx"
                                @click="switchSource(idx)"
                                class="px-2 py-1 rounded text-[11px] transition-all border"
                                :class="idx === currentSourceIndex
                                    ? 'bg-gray-200 border-gray-100 text-black'
                                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-gray-300'"
                            >
                                {{ src.from }}
                            </button>
                        </div>
                    </div>

                    <div class="p-4 border-b border-[#333] flex justify-between items-center bg-[#111] sticky top-0 z-10">
                        <h3 class="font-bold text-gray-200">播放列表</h3>
                        <button @click="reversed = !reversed" class="text-xs text-pink-500 hover:text-pink-400">
                            {{ reversed ? '正序' : '倒序' }}
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-2 scrollbar-hide">
                        <div class="grid grid-cols-2 md:grid-cols-1 gap-2">
                            <button 
                                v-for="(ep, index) in displayEpisodes" 
                                :key="index"
                                @click="switchEpisode(ep.originalIndex)"
                                class="p-3 rounded-lg text-sm text-left transition-all border group relative overflow-hidden"
                                :class="ep.originalIndex === currentIndex 
                                    ? 'bg-pink-600/10 border-pink-600/50 text-pink-500' 
                                    : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:border-gray-500 hover:text-gray-200'"
                            >
                                <span class="relative z-10">{{ getEpisodeTitle(ep.text, ep.originalIndex) }}</span>
                                <div v-if="ep.originalIndex === currentIndex" class="absolute left-0 top-0 bottom-0 w-1 bg-pink-600"></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </NuxtLayout>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { definePageMeta, navigateTo } from '#imports';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

definePageMeta({
    layout: false
});

const route = useRoute();
const router = useRouter();
const { getDetail } = useVideoApi();
const { addHistory, updateProgress } = usePlayHistory();
const { results: searchResults } = useSearchState();

const artRef = ref<HTMLDivElement | null>(null);
const url = computed(() => route.query.url as string);
const title = computed(() => route.query.title as string);
const id = computed(() => route.query.id as string);
const source = computed(() => route.query.source as string);
const initialIndex = computed(() => parseInt(route.query.index as string || '0'));

// Resource (Site) switching
const otherResourceSites = computed(() => {
    if (!title.value) return [];
    // Filter results with same name, and unique source+id
    const seen = new Set();
    return searchResults.value.filter((item: any) => {
        if (item.vod_name !== title.value) return false;
        const key = `${item.source_code}_${item.vod_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
});

const playList = ref<{ from: string, episodes: string[] }[]>([]);
const currentSourceIndex = ref(0);
const episodes = computed(() => playList.value[currentSourceIndex.value]?.episodes || []);
const currentIndex = ref(initialIndex.value);
const autoplay = ref(true);
const reversed = ref(false);
const detailData = ref<any>(null);

let art: Artplayer | null = null;

const currentEpisodeTitle = computed(() => {
    if (!episodes.value[currentIndex.value]) return '';
    const ep = episodes.value[currentIndex.value];
    return ep.includes('$') ? ep.split('$')[0] : `第${currentIndex.value + 1}集`;
});

const displayEpisodes = computed(() => {
    const list = episodes.value.map((ep, i) => ({ text: ep, originalIndex: i }));
    return reversed.value ? [...list].reverse() : list;
});

const getEpisodeTitle = (ep: string, idx: number) => {
    return ep.includes('$') ? ep.split('$', 2)[0] : `第${idx + 1}集`;
};

const getEpisodeUrl = (ep: string) => {
    return ep.includes('$') ? ep.split('$', 2)[1] : ep;
};

const initArtplayer = (videoUrl: string) => {
    if (!artRef.value) return;

    if (art) {
        art.destroy();
    }

    art = new Artplayer({
        container: artRef.value,
        url: videoUrl,
        type: 'm3u8',
        title: title.value,
        volume: 0.7,
        autoplay: true,
        pip: true,
        autoSize: true,
        autoMini: true,
        screenshot: true,
        setting: true,
        playbackRate: true,
        aspectRatio: true,
        fullscreen: true,
        fullscreenWeb: true,
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoPlayback: true,
        airplay: true,
        theme: '#ff0057',
        lang: 'zh-cn',
        customType: {
            m3u8: function (video: HTMLMediaElement, url: string, art: any) {
                if (Hls.isSupported()) {
                    if (art.hls) art.hls.destroy();
                    const hls = new Hls();
                    hls.loadSource(url);
                    hls.attachMedia(video);
                    art.hls = hls;
                    art.on('destroy', () => hls.destroy());
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                }
            },
        },
    });

    art.on('video:ended', () => {
        if (autoplay.value && currentIndex.value < episodes.value.length - 1) {
            playNext();
        }
    });

    art.on('video:timeupdate', () => {
        if (art && id.value) {
            updateProgress(id.value, art.currentTime, art.duration);
        }
    });

    art.on('video:error', () => {
        art?.notice.show('播放失败，请尝试切换线路');
    });
};

const switchEpisode = (index: number) => {
    if (index < 0 || index >= episodes.value.length) return;
    currentIndex.value = index;
    const nextEp = episodes.value[index];
    const nextUrl = getEpisodeUrl(nextEp);
    
    // Update URL query without reloading
    router.replace({
        query: {
            ...route.query,
            url: nextUrl,
            index: index.toString()
        }
    });

    initArtplayer(nextUrl);
    
    // Update history
    if (detailData.value) {
        addHistory({
            id: id.value,
            title: title.value,
            cover: detailData.value.vod_pic,
            url: nextUrl,
            episodeTitle: getEpisodeTitle(nextEp, index),
            episodeIndex: index,
            currentTime: 0,
            totalTime: 0,
            progress: 0
        });
    }
};

const playNext = () => switchEpisode(currentIndex.value + 1);
const playPrev = () => switchEpisode(currentIndex.value - 1);

const switchSource = (index: number) => {
    if (index === currentSourceIndex.value) return;
    currentSourceIndex.value = index;
    // Reset or keep index
    const newIdx = Math.min(currentIndex.value, episodes.value.length - 1);
    switchEpisode(newIdx);
};

const switchResource = async (siteItem: any) => {
    if (siteItem.source_code === source.value && siteItem.vod_id === id.value) return;
    
    // Jump to the new site's play page
    // We try to pass the same episode index
    navigateTo({
        path: '/play',
        query: {
            id: siteItem.vod_id,
            source: siteItem.source_code,
            title: title.value,
            index: currentIndex.value.toString()
        }
    });
    
    // navigateTo in same page might not trigger full reload depending on setup
    // But since it's a different query, it should.
    // If it doesn't, we can use a watcher on route.query.id
};

const copyPlayLink = () => {
    const ep = episodes.value[currentIndex.value];
    if (!ep) return;
    const currentUrl = getEpisodeUrl(ep);
    if (currentUrl) {
        navigator.clipboard.writeText(currentUrl).then(() => {
            if (art) {
                art.notice.show = '播放链接已复制到剪贴板';
            }
        });
    }
};

const loadDetail = async () => {
    if (id.value && source.value) {
        const detail = await getDetail(id.value, source.value);
        if (detail) {
            detailData.value = detail;
            playList.value = detail.playList || [];
            
            // Find current source if possible
            if (route.query.from) {
                const sIdx = playList.value.findIndex((p: any) => p.from === route.query.from);
                if (sIdx !== -1) currentSourceIndex.value = sIdx;
            }
            
            // Sync current index if needed
            if (url.value) {
                const idx = episodes.value.findIndex(ep => ep.includes(url.value));
                if (idx !== -1) currentIndex.value = idx;
            }

            // 2. Add to history
            addHistory({
                id: id.value,
                title: title.value,
                cover: detail.vod_pic,
                url: url.value,
                episodeTitle: currentEpisodeTitle.value,
                episodeIndex: currentIndex.value,
                currentTime: parseInt(route.query.currentTime as string || '0'),
                totalTime: 0,
                progress: 0
            });

            // 3. Init player
            if (url.value) {
                initArtplayer(url.value);
                
                // Restore progress if passed
                if (route.query.currentTime && art) {
                    const time = parseInt(route.query.currentTime as string);
                    art.once('video:canplay', () => {
                        art!.currentTime = time;
                    });
                }
            }
        }
    }
};

onMounted(() => {
    loadDetail();
});

// Watch for resource/id/source changes to reload without full page refresh
watch([() => route.query.id, () => route.query.source], () => {
    loadDetail();
}, { deep: true });

onBeforeUnmount(() => {
    if (art) {
        art.destroy();
    }
});
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>

<style>
/* Adjust subtitle size if necessary */
.art-subtitle {
    font-size: 24px;
}
</style>
