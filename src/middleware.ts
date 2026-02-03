import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// このミドルウェアが対象にするパス
export const config = {
  matcher: [
    '/admin/:path*',  // 管理画面は認証必要
  ],
}

// /admin 以下は認証済みでないとアクセス不可
export default withAuth(
  function middleware(req) {
    // 認証済みの場合はそのまま続行
    return NextResponse.next()
  },
  {
    // 認証されていない場合はログインページにリダイレクト
    pages: {
      signIn: '/login',
    },
  }
)
