<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_SITES } from '~/utils/config';
import { useSettings } from '~/composables/useSettings';

const props = defineProps<{ show: boolean }>();
const emit = defineEmits(['close']);

const { 
    customSources, enabledSources, showAdult, filterAds, showDouban, isAutoDisablingFilter,
    addSource, editSource, removeSource, toggleSource, setAllBuiltin, setAllCustom, deleteAllCustom, 
    importFromRemote, exportSettings, saveSettings, loadSettings 
} = useSettings();

// UI State
const newSourceName = ref('');
const newSourceUrl = ref('');
const newSourceDetail = ref('');
const newSourceIsAdult = ref(false);

const editingIndex = ref<number | null>(null);
const showUrlImport = ref(false);
const importUrl = ref('https://lunatv-config.htnf.dpdns.org/?format=3&source=jin18');
const isImporting = ref(false);

onMounted(() => {
    loadSettings();
});

const toggleAdult = () => {
    if (isAutoDisablingFilter.value) return; // Prevent toggle if adult source enabled
    showAdult.value = !showAdult.value;
    saveSettings();
};

const toggleAds = () => {
    filterAds.value = !filterAds.value;
    saveSettings();
};

const toggleDouban = () => {
    showDouban.value = !showDouban.value;
    saveSettings();
};

const handleAddSource = () => {
    if (newSourceName.value && newSourceUrl.value) {
        if (editingIndex.value !== null) {
            editSource(editingIndex.value, {
                name: newSourceName.value,
                url: newSourceUrl.value,
                detail: newSourceDetail.value,
                isAdult: newSourceIsAdult.value
            });
            editingIndex.value = null;
        } else {
            addSource({
                name: newSourceName.value,
                url: newSourceUrl.value,
                detail: newSourceDetail.value,
                isAdult: newSourceIsAdult.value
            });
        }
        resetForm();
    }
};

const startEdit = (index: number) => {
    const src = customSources.value[index];
    newSourceName.value = src.name;
    newSourceUrl.value = src.url;
    newSourceDetail.value = src.detail || '';
    newSourceIsAdult.value = src.isAdult;
    editingIndex.value = index;
};

const resetForm = () => {
    newSourceName.value = '';
    newSourceUrl.value = '';
    newSourceDetail.value = '';
    newSourceIsAdult.value = false;
    editingIndex.value = null;
};

const handleUrlImport = async () => {
    isImporting.value = true;
    const success = await importFromRemote(importUrl.value);
    isImporting.value = false;
    if (success) {
        showUrlImport.value = false;
    }
};

const triggerFileImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (res: any) => {
             try {
                 const data = JSON.parse(res.target.result);
                 if (Array.isArray(data)) {
                     customSources.value = [...customSources.value, ...data];
                     saveSettings();
                 }
             } catch (err) {
                 console.error('File import failed', err);
             }
        };
        reader.readAsText(file);
    };
    input.click();
};

const normalBuiltin = computed(() => Object.entries(API_SITES).filter(([_, s]) => !(s as any).adult));
const adultBuiltin = computed(() => Object.entries(API_SITES).filter(([_, s]) => (s as any).adult));

</script>

<template>
  <div class="fixed right-0 top-0 h-full w-80 bg-[#111] border-l border-[#333] z-40 flex flex-col transform transition-transform duration-300 shadow-2xl"
       :class="show ? 'translate-x-0' : 'translate-x-full'">
      
      <div class="flex justify-between items-center p-6 border-b border-[#333]">
            <h3 class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">设置</h3>
            <button @click="$emit('close')" class="text-gray-400 hover:text-white transition-colors bg-[#222] p-1 rounded-full w-8 h-8 flex items-center justify-center">&times;</button>
      </div>

      <div class="flex-1 p-6 space-y-8 overflow-y-auto custom-scrollbar">
          <!-- Data Source Settings -->
          <div class="bg-[#1a1a1a] rounded-lg p-4 border border-[#333]">
              <h4 class="text-gray-400 text-sm font-medium mb-4 pb-2 border-b border-[#333] flex justify-between items-center">
                  数据源设置
                  <span class="text-xs font-normal text-blue-400">已选: {{ enabledSources.length }}</span>
              </h4>
              
              <div class="flex flex-wrap gap-2 mb-4 text-[10px]">
                  <button @click="setAllBuiltin(true)" class="bg-[#333] hover:bg-[#444] text-white px-2 py-1 rounded transition-colors">全选</button>
                  <button @click="setAllBuiltin(false)" class="bg-[#333] hover:bg-[#444] text-white px-2 py-1 rounded transition-colors">全不选</button>
                  <button @click="setAllBuiltin(true, true)" class="bg-[#333] hover:bg-[#444] text-white px-2 py-1 rounded transition-colors">全选普通资源</button>
              </div>

              <!-- Normal Sources -->
              <div class="mb-4">
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">普通资源</div>
                  <div class="grid grid-cols-2 gap-2">
                       <div v-for="([key, site]) in normalBuiltin" :key="key" class="flex items-center space-x-2">
                            <div 
                                @click="toggleSource(key)"
                                class="w-3.5 h-3.5 border border-[#555] rounded flex items-center justify-center cursor-pointer transition-colors"
                                :class="enabledSources.includes(key) ? 'bg-blue-600 border-blue-600' : 'bg-[#222]'"
                            >
                                <svg v-if="enabledSources.includes(key)" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <span class="text-xs text-gray-300 truncate cursor-pointer select-none" @click="toggleSource(key)">{{ site.name }}</span>
                       </div>
                  </div>
              </div>

              <!-- Adult Sources -->
              <div v-if="!isAutoDisablingFilter && showAdult">
                   <div class="text-[10px] text-pink-500/70 uppercase tracking-wider mb-2 flex items-center gap-1">
                       黄色资源采集站
                       <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                   </div>
                   <div class="grid grid-cols-2 gap-2">
                       <div v-for="([key, site]) in adultBuiltin" :key="key" class="flex items-center space-x-2">
                            <div 
                                @click="toggleSource(key)"
                                class="w-3.5 h-3.5 border border-[#555] rounded flex items-center justify-center cursor-pointer transition-colors"
                                :class="enabledSources.includes(key) ? 'bg-pink-600 border-pink-600' : 'bg-[#222]'"
                            >
                                <svg v-if="enabledSources.includes(key)" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <span class="text-xs truncate cursor-pointer select-none text-pink-400/80" @click="toggleSource(key)">{{ site.name }}</span>
                       </div>
                   </div>
              </div>
          </div>

          <!-- Custom API Settings -->
          <div class="bg-[#1a1a1a] rounded-lg p-4 border border-[#333]">
              <div class="flex justify-between items-center mb-4 pb-2 border-b border-[#333]">
                  <h4 class="text-sm font-medium text-gray-400">自定义API</h4>
                  <div class="flex gap-1.5">
                      <button @click="triggerFileImport" class="w-6 h-6 bg-[#333] rounded hover:bg-[#444] text-white flex items-center justify-center text-xs" title="本地导入">📂</button>
                      <button @click="showUrlImport = !showUrlImport" class="w-6 h-6 bg-[#333] rounded hover:bg-[#444] text-white flex items-center justify-center text-xs" title="URL链接导入">🔗</button>
                      <button @click="deleteAllCustom" class="w-6 h-6 bg-[#333] rounded hover:bg-red-900 text-red-400 flex items-center justify-center text-xs" title="全删">🗑</button>
                  </div>
              </div>

              <!-- URL Import Section -->
              <div v-if="showUrlImport" class="mb-4 p-3 bg-[#222] rounded border border-blue-500/30">
                  <div class="text-[10px] text-blue-400 mb-2 font-medium">URL导入 (支持加密配置)</div>
                  <input v-model="importUrl" class="w-full bg-[#111] border border-[#333] rounded px-2 py-1.5 text-xs text-white mb-2">
                  <div class="flex gap-2">
                      <button @click="handleUrlImport" :disabled="isImporting" class="flex-1 bg-blue-600 text-white text-[10px] py-1 rounded">{{ isImporting ? '导入中...' : '提交' }}</button>
                      <button @click="showUrlImport = false" class="px-2 py-1 bg-[#333] text-white text-[10px] rounded">取消</button>
                  </div>
              </div>

              <!-- List with Bulk Actions -->
               <div v-if="customSources.length > 0" class="flex gap-2 mb-2">
                   <button @click="setAllCustom(true)" class="text-[10px] text-blue-400 hover:underline">全选</button>
                   <button @click="setAllCustom(false)" class="text-[10px] text-blue-400 hover:underline">全不选</button>
               </div>

               <div class="space-y-1.5 mb-4 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                   <div v-for="(src, idx) in customSources" :key="idx" class="group bg-[#222] p-2 rounded border border-transparent hover:border-[#444] transition-all">
                        <div class="flex items-center justify-between mb-1">
                            <div class="flex items-center space-x-2 truncate">
                                <div 
                                    @click="toggleSource(`custom_${idx}`)"
                                    class="w-3 h-3 border border-[#555] rounded flex items-center justify-center cursor-pointer shrink-0"
                                    :class="enabledSources.includes(`custom_${idx}`) ? 'bg-blue-600 border-blue-600' : 'bg-[#222]'"
                                >
                                    <svg v-if="enabledSources.includes(`custom_${idx}`)" class="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <span class="text-xs font-medium truncate" :class="src.isAdult ? 'text-pink-400' : 'text-white'">
                                    <span v-if="src.isAdult" class="mr-1">(18+)</span>{{ src.name }}
                                </span>
                            </div>
                            <div class="flex transition-opacity opacity-0 group-hover:opacity-100">
                                <button @click="startEdit(idx)" class="px-1 text-xs text-blue-400 hover:text-blue-300">✎</button>
                                <button @click="removeSource(idx)" class="px-1 text-xs text-red-500 hover:text-red-400">✕</button>
                            </div>
                        </div>
                        <div class="text-[10px] text-gray-500 truncate ml-5">{{ src.url }}</div>
                   </div>
                   <div v-if="customSources.length === 0" class="text-gray-500 text-xs text-center py-6 border border-dashed border-[#333] rounded">暂无自定义API</div>
               </div>

               <!-- Form -->
               <div class="bg-[#111] p-3 rounded border border-[#333] space-y-2">
                   <div class="text-[10px] text-gray-500 font-medium">{{ editingIndex !== null ? '修改API' : '快速添加' }}</div>
                   <input v-model="newSourceName" placeholder="名称" class="w-full bg-[#222] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors">
                   <input v-model="newSourceUrl" placeholder="接口URL" class="w-full bg-[#222] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors">
                   <input v-model="newSourceDetail" placeholder="详情地址 (可选)" class="w-full bg-[#222] border border-[#333] rounded px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none transition-colors">
                   <div class="flex items-center justify-between py-1">
                       <label class="text-[10px] text-pink-400 flex items-center cursor-pointer">
                           <input type="checkbox" v-model="newSourceIsAdult" class="mr-1.5 w-3 h-3 accent-pink-500">
                           标记为成人资源
                       </label>
                       <div class="flex gap-2">
                           <button v-if="editingIndex !== null" @click="resetForm" class="bg-[#333] text-white rounded px-3 py-1 text-[10px]">取消</button>
                           <button @click="handleAddSource" class="bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-1 text-[10px] font-bold transition-colors">
                               {{ editingIndex !== null ? '更新' : '添加' }}
                           </button>
                       </div>
                   </div>
               </div>
          </div>

          <!-- Function Switches -->
          <div class="bg-[#1a1a1a] rounded-lg p-4 border border-[#333]">
              <h4 class="text-gray-400 text-sm font-medium mb-4 pb-2 border-b border-[#333]">功能开关</h4>
              
              <div class="space-y-4">
                  <!-- Adult Filter -->
                  <div class="flex items-center justify-between" :class="isAutoDisablingFilter ? 'opacity-50' : ''">
                      <div>
                          <div class="text-sm text-white">黄色内容过滤</div>
                          <div class="text-xs" :class="isAutoDisablingFilter ? 'text-pink-300' : 'text-gray-500'">
                              {{ isAutoDisablingFilter ? '选中黄色资源时强制关闭' : '过滤"伦理片"等黄色内容' }}
                          </div>
                      </div>
                      <button 
                        @click="toggleAdult"
                        :disabled="isAutoDisablingFilter"
                        :class="(!showAdult && !isAutoDisablingFilter) ? 'bg-blue-500' : 'bg-[#333]'"
                        class="relative w-10 h-5 transition-colors duration-200 rounded-full"
                      >
                        <div :class="(!showAdult && !isAutoDisablingFilter) ? 'translate-x-5' : 'translate-x-1'" class="absolute w-3 h-3 transition-transform duration-200 bg-white rounded-full top-1"></div>
                      </button>
                  </div>

                  <!-- Ad Filter -->
                  <div class="flex items-center justify-between">
                      <div>
                          <div class="text-sm text-white">分片广告过滤</div>
                          <div class="text-xs text-gray-500">播放器内置广告分片屏蔽</div>
                      </div>
                       <button 
                        @click="toggleAds"
                        :class="filterAds ? 'bg-blue-500' : 'bg-[#333]'"
                        class="relative w-10 h-5 transition-colors duration-200 rounded-full"
                      >
                        <div :class="filterAds ? 'translate-x-5' : 'translate-x-1'" class="absolute w-3 h-3 transition-transform duration-200 bg-white rounded-full top-1"></div>
                      </button>
                  </div>

                  <!-- Douban -->
                  <div class="flex items-center justify-between">
                      <div>
                          <div class="text-sm text-white">豆瓣热门推荐</div>
                          <div class="text-xs text-gray-500">首页条件显示豆瓣数据</div>
                      </div>
                       <button 
                        @click="toggleDouban"
                        :class="showDouban ? 'bg-pink-500' : 'bg-[#333]'"
                        class="relative w-10 h-5 transition-colors duration-200 rounded-full"
                      >
                        <div :class="showDouban ? 'translate-x-5' : 'translate-x-1'" class="absolute w-3 h-3 transition-transform duration-200 bg-white rounded-full top-1"></div>
                      </button>
                  </div>
              </div>
          </div>
          
           <!-- General Functions -->
          <div class="bg-[#1a1a1a] rounded-lg p-4 border border-[#333]">
              <h4 class="text-gray-400 text-sm font-medium mb-4 pb-2 border-b border-[#333]">一般功能</h4>
              <div class="grid grid-cols-2 gap-3">
                  <button @click="triggerFileImport" class="bg-[#222] hover:bg-[#333] text-white rounded py-2 text-[10px] font-bold border border-[#333]">导入本地配置</button>
                  <button @click="exportSettings" class="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded py-2 text-[10px] font-bold shadow-lg">导出当前配置</button>
              </div>
              <div class="mt-4 text-center">
                  <a href="https://github.com/nanfenghuiyi/LibreTV" target="_blank" class="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">LibreTV Nuxt Refactor @ 2025</a>
              </div>
          </div>

      </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: #111;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #555;
}

input::placeholder {
    color: #555;
}
</style>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: #111;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #555;
}
</style>
