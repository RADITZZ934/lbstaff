// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  runtimeConfig: {
    backendUrl: process.env.BACKEND_URL || 'http://127.0.0.1:10002',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api'
    }
  },
  routeRules: {
    '/api/**': {
      proxy: `${process.env.BACKEND_URL || 'http://127.0.0.1:10002'}/api/**`
    },
    '/uploads/**': {
      proxy: `${process.env.BACKEND_URL || 'http://127.0.0.1:10002'}/uploads/**`
    }
  },
  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
