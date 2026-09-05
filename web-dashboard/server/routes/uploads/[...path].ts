import http from 'node:http'

export default defineEventHandler(async (event) => {
  const backendBase = (process.env.BACKEND_URL || 'http://127.0.0.1:10002').replace(/\/+$/, '')
  const subPath = event.context.params?.path || ''
  const targetUrl = new URL(`${backendBase}/uploads/${subPath}`)

  return new Promise<void>((resolve, reject) => {
    const headers = { ...event.node.req.headers }
    delete headers.host

    const clientReq = http.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port || 10002,
      path: targetUrl.pathname + targetUrl.search,
      method: event.method,
      headers
    }, (clientRes) => {
      event.node.res.writeHead(clientRes.statusCode || 200, clientRes.headers)
      clientRes.pipe(event.node.res)
      clientRes.on('end', () => resolve())
      clientRes.on('error', (err) => reject(err))
    })

    clientReq.on('error', (err) => {
      console.error('[Uploads Proxy Error]:', err.message)
      if (!event.node.res.headersSent) {
        event.node.res.writeHead(502, { 'Content-Type': 'application/json' })
      }
      event.node.res.end(JSON.stringify({ success: false, error: err.message }))
      resolve()
    })

    event.node.req.pipe(clientReq)
  })
})
