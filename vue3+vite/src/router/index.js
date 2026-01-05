import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/watch',
    name: 'Watch',
    component: () => import('../views/WatchView.vue')
  },
  {
    path: '/player',
    name: 'Player',
    component: () => import('../views/PlayerView.vue')
  },
  {
    path: '/api-manager',
    name: 'ApiManager',
    component: () => import('../views/ApiManagerView.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue')
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/AboutView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
