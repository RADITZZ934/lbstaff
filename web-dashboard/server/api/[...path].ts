export default defineEventHandler(async (event) => {
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:10002').replace(/\/+$/, '')
  const path = event.context.params?.path || ''
  const query = getQuery(event)
  const queryString = new URLSearchParams(query as Record<string, string>).toString()
  const target = `${backendBase}/api/${path}${queryString ? `?${queryString}` : ''}`

  return proxyRequest(event, target)
})
