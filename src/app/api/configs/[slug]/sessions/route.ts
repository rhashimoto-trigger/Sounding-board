import { NextResponse, NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/configs/[slug]/sessions
 * そのURLに対する生徒一覧を取得する
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })
  if (!token?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // まず config が自分の先生のものか確認
  const { data: config } = await supabase
    .from('chat_configs')
    .select('id')
    .eq('slug', params.slug)
    .eq('teacher_id', token.id as string)
    .single() as { data: { id: string } | null }

  if (!config) {
    return NextResponse.json({ error: 'データが見つかりません' }, { status: 404 })
  }

  // セッション一覧を取得（メッセージ本文は含まない）
  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('id, grade, class_name, seat_number, student_name, message_count, status, summary, advice, created_at, updated_at')
    .eq('config_id', config.id)
    .order('created_at', { ascending: false }) as { data: any[] }

  return NextResponse.json({ sessions: sessions || [] })
}
