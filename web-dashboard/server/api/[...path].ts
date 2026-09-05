export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const backendBase = (config.backendUrl || process.env.BACKEND_URL || 'http://127.0.0.1:10002').replace(/\/+$/, '')
  const path = event.context.params?.path || ''
  const query = getQuery(event)
  const queryString = new URLSearchParams(query as Record<string, string>).toString()
  const targetUrl = `${backendBase}/api/${path}${queryString ? `?${queryString}` : ''}`

  return sendProxy(event, targetUrl, {
    headers: {
      host: '127.0.0.1:10002'
    }
  })
})
