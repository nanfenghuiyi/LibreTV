<template>
  <div class="player-component">
    <div class="player-header">
      <h2>{{ videoTitle || '视频播放' }}</h2>
      <button @click="goBack" class="back-btn">返回</button>
    </div>
    
    <div v-if="loading" class="player-loading">
      加载播放器中...
    </div>
    
    <div v-else-if="error" class="player-error">
      {{ error }}
      <button @click="initPlayer" class="retry-btn">重试</button>
    </div>
    
    <div v-else>
      <div ref="playerContainer" class="player-container"></div>
      
      <div class="video-info" v-if="videoInfo">
        <h3>{{ videoInfo.title }}</h3>
        <p>{{ videoInfo.description }}</p>
      </div>
      
      <div class="quality-switcher" v-if="videoSources.length > 1">
        <label>清晰度：</label>
        <select v-model="currentSourceIndex" @change="switchSource">
          <option v-for="(source, index) in videoSources" :key="index" :value="index">
            {{ source.label || `清晰度 ${index + 1}` }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '../store/historyStore'

const router = useRouter()
const historyStore = useHistoryStore()

// Props
const props = defineProps({
  videoUrl: {
    type: String,
    default: ''
  },
  videoTitle: {
    type: String,
    default: ''
  },
  videoInfo: {
    type: Object,
    default: null
  },
  videoSources: {
    type: Array,
    default: () => []
  }
})

// Refs
const playerContainer = ref(null)
const player = ref(null)
const loading = ref(true)
const error = ref('')
const currentSourceIndex = ref(0)

// Computed
const currentSource = () => props.videoSources[currentSourceIndex.value]

// Methods
const initPlayer = () => {
  if (!playerContainer.value) return
  
  loading.value = true
  error.value = ''
  
  try {
    // 确保ArtPlayer库已加载
    if (!window.ArtPlayer) {
      // 动态加载ArtPlayer库
      const script = document.createElement('script')
      script.src = '/libs/artplayer.min.js'
      script.onload = () => {
        createPlayerInstance()
      }
      script.onerror = () => {
        error.value = 'ArtPlayer库加载失败'
        loading.value = false
      }
      document.head.appendChild(script)
    } else {
      createPlayerInstance()
    }
  } catch (err) {
    error.value = `播放器初始化失败: ${err.message}`
    loading.value = false
  }
}

const createPlayerInstance = () => {
  if (!window.ArtPlayer || !playerContainer.value) {
    error.value = 'ArtPlayer库未加载'
    loading.value = false
    return
  }
  
  // 销毁旧实例
  if (player.value) {
    player.value.destroy()
  }
  
  const source = currentSource() || { url: props.videoUrl }
  
  // 创建新播放器实例
  player.value = new window.ArtPlayer({
    container: playerContainer.value,
    url: source.url,
    title: props.videoTitle,
    poster: props.videoInfo?.poster || '',
    autoSize: true,
    mutex: true,
    autoplay: false,
    fullscreen: true,
    fullscreenWeb: true,
    pip: true,
    screenshot: true,
    setting: true,
    loop: false,
    flip: true,
    playbackRate: true,
    aspectRatio: true,
    lang: 'zh-CN',
    fastForward: true,
    miniProgressBar: true,
    theme: '#2563eb',
    volume: 1,
    muted: false,
    preload: 'auto',
    videoType: source.type || '',
    customType: {
      m3u8: function(video, url) {
        if (window.Hls) {
          const hls = new window.Hls()
          hls.loadSource(url)
          hls.attachMedia(video)
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url
        }
      }
    },
    plugins: [
      // 可以添加自定义插件
    ],
    contextmenu: [
      {
        html: 'LibreTV',
        click: function() {
          console.log('LibreTV')
        }
      }
    ],
    moreVideoAttr: {
      crossOrigin: 'anonymous'
    }
  })
  
  // 监听播放器事件
  player.value.on('ready', () => {
    loading.value = false
    console.log('播放器已准备就绪')
  })
  
  player.value.on('error', (err) => {
    error.value = `播放器错误: ${err.message}`
    loading.value = false
    console.error('播放器错误:', err)
  })
  
  player.value.on('play', () => {
    console.log('开始播放')
    // 添加到观看历史
    if (props.videoInfo) {
      historyStore.addToHistory({
        id: props.videoInfo.id || Date.now(),
        title: props.videoInfo.title || props.videoTitle,
        poster: props.videoInfo.poster || '',
        url: source.url,
        source: 'unknown',
        watchedAt: new Date().toISOString()
      })
    }
  })
  
  player.value.on('timeupdate', () => {
    // 可以在这里保存播放进度
  })
  
  player.value.on('ended', () => {
    console.log('播放结束')
  })
}

const switchSource = () => {
  if (player.value) {
    const source = currentSource()
    if (source) {
      player.value.switchUrl(source.url, {
        videoType: source.type || ''
      })
    }
  }
}

const goBack = () => {
  router.back()
}

// Lifecycle hooks
onMounted(() => {
  // 动态加载HLS.js（如果需要）
  if (props.videoUrl && props.videoUrl.includes('.m3u8')) {
    const hlsScript = document.createElement('script')
    hlsScript.src = '/libs/hls.min.js'
    document.head.appendChild(hlsScript)
  }
  
  // 初始化播放器
  initPlayer()
})

onUnmounted(() => {
  // 销毁播放器实例
  if (player.value) {
    player.value.destroy()
    player.value = null
  }
})

// Watch for prop changes
watch(() => props.videoUrl, (newUrl) => {
  if (newUrl && player.value) {
    player.value.switchUrl(newUrl)
  }
})

watch(() => props.videoSources, (newSources) => {
  if (newSources.length > 0 && player.value) {
    currentSourceIndex.value = 0
    switchSource()
  }
}, { deep: true })
</script>

<style scoped>
.player-component {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.player-header h2 {
  margin: 0;
  color: #333;
}

.back-btn {
  padding: 8px 16px;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.back-btn:hover {
  background-color: #1d4ed8;
}

.player-loading, .player-error {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 500px;
  background-color: #f9fafb;
  border-radius: 8px;
  color: #666;
}

.player-error {
  background-color: #fee2e2;
  color: #dc2626;
}

.retry-btn {
  margin-top: 15px;
  padding: 8px 16px;
  background-color: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.retry-btn:hover {
  background-color: #1d4ed8;
}

.player-container {
  width: 100%;
  height: 500px;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.video-info {
  margin-bottom: 20px;
}

.video-info h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}

.video-info p {
  margin: 0;
  color: #666;
  line-height: 1.6;
}

.quality-switcher {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.quality-switcher label {
  color: #333;
  font-weight: 500;
}

.quality-switcher select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background-color: white;
  font-size: 0.9rem;
}

.quality-switcher select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

@media (max-width: 768px) {
  .player-component {
    padding: 10px;
  }
  
  .player-container {
    height: 300px;
  }
  
  .player-loading, .player-error {
    height: 300px;
  }
  
  .player-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .quality-switcher {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
