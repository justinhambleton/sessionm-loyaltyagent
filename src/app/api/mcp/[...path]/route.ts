import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function getBaseUrl() {
  const base = process.env.MCP_BACKEND_SERVER
  if (!base) {
    throw new Error('MCP_BACKEND_SERVER is not set. Configure it in your hosting provider env settings.')
  }
  return base.replace(/\/$/, '')
}

function buildTargetUrl(req: NextRequest, pathSegments: string[]) {
  const base = getBaseUrl()
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : ''
  const search = req.nextUrl.search || ''
  return `${base}/${path}${search}`
}

function forwardHeaders(req: NextRequest): Headers {
  const headers = new Headers()
  const allowList = ['authorization', 'content-type', 'accept', 'session-id']
  req.headers.forEach((value, key) => {
    if (allowList.includes(key.toLowerCase())) {
      // Normalize Session-Id header casing for upstream FastAPI alias
      if (key.toLowerCase() === 'session-id') {
        headers.set('Session-Id', value)
      } else {
        headers.set(key, value)
      }
    }
  })
  return headers
}

async function handleProxy(req: NextRequest, pathSegments: string[]) {
  const url = buildTargetUrl(req, pathSegments)
  const method = req.method || 'GET'

  const initBody = method === 'GET' || method === 'HEAD' ? undefined : await req.text()
  const headers = forwardHeaders(req)

  const controller = new AbortController()
  const timeoutMs = Number(process.env.MCP_PROXY_TIMEOUT_MS || 30000)
  const start = Date.now()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Minimal server-side logging to help diagnose issues
    console.log(`[proxy] -> ${method} ${url}`)
    const upstream = await fetch(url, {
      method,
      headers,
      body: initBody,
      signal: controller.signal,
    })
    const took = Date.now() - start
    console.log(`[proxy] <- ${upstream.status} ${method} ${url} (${took}ms)`) // status + timing

    const upstreamHeaders = new Headers(upstream.headers)
    // Strip headers that can cause client decoding issues or are unnecessary for same-origin API
    upstreamHeaders.delete('access-control-allow-origin')
    upstreamHeaders.delete('access-control-allow-credentials')
    upstreamHeaders.delete('content-encoding')
    upstreamHeaders.delete('transfer-encoding')
    upstreamHeaders.delete('content-length')
    upstreamHeaders.delete('connection')

    // Stream the upstream response to the client to reduce buffering and TTFB
    return new Response(upstream.body, { status: upstream.status, headers: upstreamHeaders })
  } catch (err: unknown) {
    const took = Date.now() - start
    let message = 'Upstream fetch failed'
    if (typeof err === 'object' && err !== null && 'name' in err && (err as { name?: string }).name === 'AbortError') {
      message = `Upstream timeout after ${timeoutMs}ms`
    } else if (err instanceof Error) {
      message = err.message
    }
    console.error(`[proxy] x  ${method} ${url} (${took}ms):`, message)
    return new Response(JSON.stringify({ detail: message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await params
  return handleProxy(req, path)
}
export async function HEAD(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await params
  return handleProxy(req, path)
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await params
  return handleProxy(req, path)
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await params
  return handleProxy(req, path)
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await params
  return handleProxy(req, path)
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await params
  return handleProxy(req, path)
}
export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path = [] } = await params
  return handleProxy(req, path)
}
