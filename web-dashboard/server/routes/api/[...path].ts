export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const backendBase = config.backendUrl || process.env.BACKEND_URL || 'http://127.0.0.1:10002'
  const subPath = event.context.params?.path || ''
  const query = getQuery(event)
  const queryString = new URLSearchParams(query as Record<string, string>).toString()
  const target = `${backendBase}/api/${subPath}${queryString ? `?${queryString}` : ''}`

  return proxyRequest(event, target)
})
