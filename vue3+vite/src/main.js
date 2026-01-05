import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// 导入全局样式
import '../css/styles.css'
import '../css/index.css'
import '../css/player.css'
import '../css/watch.css'
import '../css/modals.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
