import { NextResponse, NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/sessions/[sessionId]
 * 生徒1人のセッション詳細（要約＋メッセージ一覧）を取得する
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })
  if (!token?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // セッション取得
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .single() as { data: any }

  if (!session) {
    return NextResponse.json({ error: 'データが見つかりません' }, { status: 404 })
  }

  // この生徒のセッションが自分の先生のURLかどうか確認
  const { data: config } = await supabase
    .from('chat_configs')
    .select('id, slug, title, theme')
    .eq('id', session.config_id)
    .eq('teacher_id', token.id as string)
    .single() as { data: any }

  if (!config) {
    return NextResponse.json({ error: 'アクセス権がありません' }, { status: 403 })
  }

  // メッセージ一覧を取得（プライバシー保護中の場合は空配列）
  let messages: any[] = []
  if (!session.hide_messages_from_teacher) {
    const { data } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('session_id', params.sessionId)
      .order('created_at', { ascending: true }) as { data: any[] }
    messages = data || []
  }

  return NextResponse.json({
    session,
    config,
    messages,
  })
}
