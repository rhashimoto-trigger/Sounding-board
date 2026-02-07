import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/chat/[slug]/privacy
 * 生徒がプライバシー設定を変更する
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { session_id, hide_messages } = await req.json()

  if (!session_id || typeof hide_messages !== 'boolean') {
    return NextResponse.json({ error: '無効なリクエストです' }, { status: 400 })
  }

  // セッションを取得
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, config_id')
    .eq('id', session_id)
    .single() as { data: any }

  if (!session) {
    return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
  }

  // configを取得（プライバシー設定が許可されているか確認）
  const { data: config } = await supabase
    .from('chat_configs')
    .select('allow_student_privacy_toggle')
    .eq('id', session.config_id)
    .eq('slug', params.slug)
    .single() as { data: any }

  if (!config) {
    return NextResponse.json({ error: 'URLが見つかりません' }, { status: 404 })
  }

  if (!config.allow_student_privacy_toggle) {
    return NextResponse.json({ error: 'この機能は有効になっていません' }, { status: 403 })
  }

  // プライバシー設定を更新
  const { error } = await supabase
    .from('chat_sessions')
    .update({ hide_messages_from_teacher: hide_messages })
    .eq('id', session_id)

  if (error) {
    return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ success: true, hide_messages })
}
