export const useApi = () => {
  const config = useRuntimeConfig()
  const apiBase = computed(() => config.public.apiBase || '/api')

  const getApiUrl = (path: string) => {
    if (!path) return ''
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`

    // Jika apiBase berupa URL absolut (misal: http://localhost:10002)
    if (apiBase.value.startsWith('http://') || apiBase.value.startsWith('https://')) {
      const base = apiBase.value.replace(/\/+$/, '')
      if (cleanPath.startsWith('/api/')) {
        return `${base}${cleanPath}`
      }
      return `${base}/api${cleanPath}`
    }

    // Jika menggunakan proxy Nitro bawaan (/api)
    if (cleanPath.startsWith('/api/')) {
      return cleanPath
    }
    return `/api${cleanPath}`
  }

  const resolveUploadUrl = (path: string | null | undefined) => {
    if (!path) return ''
    let cleanPath = path.replace(/\\/g, '/')
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      return cleanPath
    }
    if (cleanPath.includes('lbstaff_uploads/')) {
      cleanPath = cleanPath.split('lbstaff_uploads/')[1]
    }
    cleanPath = cleanPath.replace(/^\/?(uploads|upload)\/?/, '')
    return `/uploads/${cleanPath}`
  }

  return {
    apiBase,
    getApiUrl,
    resolveUploadUrl
  }
}
