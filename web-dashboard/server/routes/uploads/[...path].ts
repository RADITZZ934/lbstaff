export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const backendBase = (config.backendUrl || process.env.BACKEND_URL || 'http://127.0.0.1:10002').replace(/\/+$/, '')
  const subPath = event.context.params?.path || ''
  const targetUrl = `${backendBase}/uploads/${subPath}`

  return sendProxy(event, targetUrl, {
    headers: {
      host: '127.0.0.1:10002'
    }
  })
})
