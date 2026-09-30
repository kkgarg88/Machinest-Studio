import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED = ['/dashboard', '/studio', '/cycle', '/profile', '/membership', '/admin']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const isProtected = PROTECTED.some(p => request.nextUrl.pathname.startsWith(p))
  if (!isProtected) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (request.nextUrl.pathname.startsWith('/admin')) {
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/studio/:path*', '/cycle/:path*', '/profile/:path*', '/membership/:path*', '/admin/:path*'],
}