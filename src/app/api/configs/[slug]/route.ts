import { NextResponse, NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/configs/[slug]
 * slugからURL設定の詳細を取得する
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })
  if (!token?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: config } = await supabase
    .from('chat_configs')
    .select('*')
    .eq('slug', params.slug)
    .eq('teacher_id', token.id as string)
    .single() as { data: any }

  if (!config) {
    return NextResponse.json({ error: 'データが見つかりません' }, { status: 404 })
  }

  return NextResponse.json({ config })
}
