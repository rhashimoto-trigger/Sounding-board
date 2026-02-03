import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabase } from '@/lib/supabase'
import { verifyPassword } from '@/lib/auth'

const authOptions = {
  // ログインページのパス
  pages: {
    signIn: '/login',
  },
  // セッション保持方法
  session: {
    strategy: 'jwt' as const,
  },
  providers: [
    CredentialsProvider({
      name: 'ID/パスワード',
      credentials: {
        email: { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Supabaseからメールアドレスで先生を検索
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id, email, password')
          .eq('email', credentials.email)
          .single() as { data: { id: string; email: string; password: string } | null }

        if (!teacher) {
          return null
        }

        // パスワード検証
        const isValid = await verifyPassword(credentials.password, teacher.password)
        if (!isValid) {
          return null
        }

        // 認証成功 → ユーザーオブジェクトを返す
        return {
          id: teacher.id,
          email: teacher.email,
        }
      },
    }),
  ],
  // JWTトークンにカスタム情報を追加
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user = {
          id: token.id,
          email: token.email,
        }
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
