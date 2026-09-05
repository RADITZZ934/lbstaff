// Polyfill Set methods for compatibility with Node 20 / older environments
if (typeof Set !== 'undefined') {
  if (!Set.prototype.difference) {
    Set.prototype.difference = function (other: Set<any>) {
      const result = new Set(this)
      for (const elem of other) {
        result.delete(elem)
      }
      return result
    }
  }
  if (!Set.prototype.union) {
    Set.prototype.union = function (other: Set<any>) {
      const result = new Set(this)
      for (const elem of other) {
        result.add(elem)
      }
      return result
    }
  }
  if (!Set.prototype.intersection) {
    Set.prototype.intersection = function (other: Set<any>) {
      const result = new Set()
      for (const elem of other) {
        if (this.has(elem)) {
          result.add(elem)
        }
      }
      return result
    }
  }
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  runtimeConfig: {
    backendUrl: process.env.BACKEND_URL || 'http://127.0.0.1:10002',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api'
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
