export default defineEventHandler(async (event) => {
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:10002').replace(/\/+$/, '')
  const subPath = event.context.params?.path || ''
  const target = `${backendBase}/uploads/${subPath}`

  return proxyRequest(event, target)
})
