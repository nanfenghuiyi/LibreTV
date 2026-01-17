export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: [
    '~/assets/css/styles.css',
    '~/assets/css/index.css'
  ],
  app: {
    head: {
      title: 'LibreTV - 免费在线视频搜索与观看平台',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/image/logo.png' }
      ]
    }
  }
})
