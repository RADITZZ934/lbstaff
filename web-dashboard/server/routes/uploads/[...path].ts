export default defineEventHandler(async (event) => {
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:10002'
  const subPath = event.context.params?.path || ''
  const target = `${backendUrl}/uploads/${subPath}`

  return proxyRequest(event, target)
})
