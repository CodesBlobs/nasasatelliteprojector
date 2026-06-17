import { NextRequest, NextResponse } from 'next/server'

const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:3001'

async function proxy(request: NextRequest, params: Promise<{ path: string[] }>) {
  const { path } = await params
  const backendUrl = new URL(`/${path.join('/')}`, API_ORIGIN)
  backendUrl.search = request.nextUrl.search

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  const auth = request.headers.get('authorization')
  if (auth) headers.set('authorization', auth)

  const isBodyless = ['GET', 'HEAD'].includes(request.method)
  const body = isBodyless ? undefined : await request.text()

  const response = await fetch(backendUrl.toString(), {
    method: request.method,
    headers,
    body,
  })

  const responseHeaders = new Headers()
  response.headers.forEach((value, key) => {
    if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  })

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
export const PUT = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
