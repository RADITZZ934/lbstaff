export default defineEventHandler(async (event) => {
  const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:10002'
  const path = event.context.params?.path || ''
  const method = event.method
  const query = getQuery(event)
  const reqHeaders = getRequestHeaders(event)

  const searchParams = new URLSearchParams(query as Record<string, string>).toString()
  const target = `${backendUrl}/api/${path}${searchParams ? `?${searchParams}` : ''}`

  const forwardHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(reqHeaders)) {
    if (value && key !== 'host' && key !== 'content-length') {
      forwardHeaders[key] = value
    }
  }

  const contentType = reqHeaders['content-type'] || ''

  // For multipart/form-data (file upload and screenshot tracking)
  if (contentType.includes('multipart/form-data')) {
    return proxyRequest(event, target)
  }

  let body: Buffer | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const raw = await readRawBody(event, false)
    if (raw) {
      body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
      forwardHeaders['content-length'] = String(body.length)
    }
  }

  try {
    const response = await fetch(target, {
      method,
      headers: forwardHeaders,
      body
    })

    event.node.res.statusCode = response.status
    response.headers.forEach((val, key) => {
      setHeader(event, key, val)
    })

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err: any) {
    console.error(`[API Proxy Error] Failed to reach ${target}:`, err.message)
    throw createError({
      statusCode: 502,
      statusMessage: `Bad Gateway: ${err.message}`
    })
  }
})
