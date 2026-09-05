export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const backendBase = (process.env.BACKEND_URL || config.backendUrl || 'http://127.0.0.1:10002').replace(/\/+$/, '')
  const subPath = event.context.params?.path || ''
  const targetUrl = `${backendBase}/uploads/${subPath}`

  try {
    const response = await fetch(targetUrl, {
      method: event.method,
      headers: { 'Accept': '*/*' }
    })

    setResponseStatus(event, response.status)
    response.headers.forEach((val, key) => {
      if (key !== 'transfer-encoding' && key !== 'content-encoding') {
        setHeader(event, key, val)
      }
    })

    const data = await response.arrayBuffer()
    return Buffer.from(data)
  } catch (err: any) {
    console.error(`[Uploads Proxy Error to ${targetUrl}]:`, err.message)
    setResponseStatus(event, 502)
    return { success: false, error: err.message }
  }
})
