import { NextRequest, NextResponse } from 'next/server'

const API_ORIGIN = process.env.API_ORIGIN || 'http://localhost:3001'

async function proxy(request: NextRequest, params: Promise<{ path: string[] }>) {
  const { path } = await params
  const backendUrl = new URL(`/${path.join('/')}`, API_ORIGIN)
  backendUrl.search = request.nextUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')

  const isBodyless = ['GET', 'HEAD'].includes(request.method)

  const response = await fetch(backendUrl.toString(), {
    method: request.method,
    headers,
    body: isBodyless ? undefined : request.body,
    // @ts-expect-error -- duplex required for streaming request bodies
    duplex: 'half',
  })

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
export const POST = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
export const PUT = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => proxy(req, ctx.params)
