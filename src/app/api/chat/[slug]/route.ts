import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateRecoveryCode } from '@/lib/utils'

/**
 * POST /api/chat/[slug]
 * 新規セッション作成
 * Body: { grade, class_name, seat_number, student_name }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  // slugからconfigを取得
  const { data: config } = await supabase
    .from('chat_configs')
    .select('id, allow_student_privacy_toggle')
    .eq('slug', params.slug)
    .single() as { data: { id: string; allow_student_privacy_toggle: boolean } | null }

  if (!config) {
    return NextResponse.json({ error: 'このURLは存在しないか、無効です' }, { status: 404 })
  }

  const { grade, class_name, seat_number, student_name } = await req.json()

  // バリデーション
  if (!grade || !class_name || !seat_number || !student_name) {
    return NextResponse.json({ error: '全項目を入力してください' }, { status: 400 })
  }

  // 復元コード生成（重複チェック付き）
  let recoveryCode = generateRecoveryCode()
  for (let i = 0; i < 10; i++) {
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('recovery_code', recoveryCode)
      .single() as { data: { id: string } | null }
    if (!existing) break
    recoveryCode = generateRecoveryCode()
  }

  // セッション作成
  const insertQuery = supabase
    .from('chat_sessions')
    .insert({
      config_id: config.id,
      grade,
      class_name,
      seat_number,
      student_name,
      recovery_code: recoveryCode,
      message_count: 0,
      status: 'active',
      summary: null,
      advice: null,
      hide_messages_from_teacher: false,
    })
    .select()

  const { data, error } = (await insertQuery) as { data: any[]; error: any }

  if (error) {
    return NextResponse.json({ error: 'セッション作成に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({
    session: {
      id: data[0].id,
      recovery_code: data[0].recovery_code,
      message_count: data[0].message_count,
      status: data[0].status,
      student_name: data[0].student_name,
      hide_messages_from_teacher: data[0].hide_messages_from_teacher,
    },
    config: {
      allow_student_privacy_toggle: config.allow_student_privacy_toggle,
    },
    messages: [],
  })
}

/**
 * GET /api/chat/[slug]?recovery_code=R-XXXXXXXX
 * 復元コードからセッションを復元する
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const recoveryCode = req.nextUrl.searchParams.get('recovery_code')

  if (!recoveryCode) {
    return NextResponse.json({ error: '復元コードが必要です' }, { status: 400 })
  }

  // slugからconfigを取得
  const { data: config } = await supabase
    .from('chat_configs')
    .select('id, allow_student_privacy_toggle')
    .eq('slug', params.slug)
    .single() as { data: { id: string; allow_student_privacy_toggle: boolean } | null }

  if (!config) {
    return NextResponse.json({ error: 'このURLは存在しないか、無効です' }, { status: 404 })
  }

  // 復元コードでセッション検索
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('recovery_code', recoveryCode)
    .eq('config_id', config.id)
    .single() as { data: any }

  if (!session) {
    return NextResponse.json({ error: '復元コードが見つかりません。確認してください' }, { status: 404 })
  }

  // 完了済みの場合はアドバイス込みで返す（フロント側でアドバイス画面へ）
  if (session.status === 'completed') {
    return NextResponse.json({
      session: {
        id: session.id,
        recovery_code: session.recovery_code,
        message_count: session.message_count,
        status: session.status,
        student_name: session.student_name,
        summary: session.summary,
        advice: session.advice,
        hide_messages_from_teacher: session.hide_messages_from_teacher,
      },
      config: {
        allow_student_privacy_toggle: config.allow_student_privacy_toggle,
      },
      messages: [],
    })
  }

  // paused の場合は active に戻す
  if (session.status === 'paused') {
    await supabase
      .from('chat_sessions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', session.id)
  }

  // メッセージ一覧を取得
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true }) as { data: any[] }

  return NextResponse.json({
    session: {
      id: session.id,
      recovery_code: session.recovery_code,
      message_count: session.message_count,
      status: 'active',
      student_name: session.student_name,
      hide_messages_from_teacher: session.hide_messages_from_teacher,
    },
    config: {
      allow_student_privacy_toggle: config.allow_student_privacy_toggle,
    },
    messages: messages || [],
  })
}
