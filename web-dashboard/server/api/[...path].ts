export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const backendBase = (process.env.BACKEND_URL || config.backendUrl || 'http://127.0.0.1:10002').replace(/\/+$/, '')
  const path = event.context.params?.path || ''
  const query = getQuery(event)
  const queryString = new URLSearchParams(query as Record<string, string>).toString()
  const targetUrl = `${backendBase}/api/${path}${queryString ? `?${queryString}` : ''}`

  try {
    const method = event.method
    const headers = { ...getHeaders(event) }
    delete headers.host
    delete headers['content-length']

    let body: any = undefined
    if (method !== 'GET' && method !== 'HEAD') {
      body = await readRawBody(event)
    }

    const response = await fetch(targetUrl, {
      method,
      headers: headers as any,
      body,
      // @ts-ignore
      duplex: 'half'
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
    console.error(`[API Proxy Error to ${targetUrl}]:`, err.message)
    setResponseStatus(event, 502)
    return { success: false, error: err.message }
  }
})
