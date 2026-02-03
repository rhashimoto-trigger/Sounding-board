import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { callAI } from '@/lib/ai'

const MAX_MESSAGES = 50 // 最大往復回数

/**
 * POST /api/chat/[slug]/messages
 * メッセージ送信＋AI返信
 * Body: { session_id, content }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { session_id, content } = await req.json()

  if (!session_id || !content) {
    return NextResponse.json({ error: 'session_id と content が必要です' }, { status: 400 })
  }

  // ---- セッション検証 ----
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', session_id)
    .single() as { data: any }

  if (!session) {
    return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
  }

  if (session.status !== 'active') {
    return NextResponse.json({ error: '会話は終了しています' }, { status: 400 })
  }

  if (session.message_count >= MAX_MESSAGES) {
    return NextResponse.json({ error: '会話の上限に達しています' }, { status: 400 })
  }

  // ---- config（先生設定）を取得 ----
  const { data: config } = await supabase
    .from('chat_configs')
    .select('*')
    .eq('id', session.config_id)
    .single() as { data: any }

  if (!config) {
    return NextResponse.json({ error: '設定データが見つかりません' }, { status: 500 })
  }

  // ---- 生徒のメッセージを保存 ----
  const userInsert = supabase
    .from('chat_messages')
    .insert({ session_id, role: 'user', content })
    .select()

  const { data: userMsgData } = (await userInsert) as { data: any[] }
  const userMessage = userMsgData[0]

  // ---- 過去の会話履歴を取得 ----
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true }) as { data: { role: string; content: string }[] }

  // ---- システムプロンプトの組み立て ----
  let systemPrompt = `あなたは高等学校の生徒と対話するAIアシスタントです。
以下の先生の設定に従って、丁寧かつ親しみやすい日本語で返答してください。
生徒の学校生活やキャリアに役立つ視点で対話してください。

【テーマ】${config.theme}
【アプローチ】${config.approach}
【重視すべき点】${config.important_points}`

  // ソースがある場合は追加
  if (config.source_text) {
    systemPrompt += `\n\n【参照資料】\n${config.source_text}`
  }

  // ---- AI APIを呼び出す ----
  let aiReplyContent: string
  try {
    aiReplyContent = await callAI({
      systemPrompt,
      messages: history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: `AI返信に失敗しました: ${err.message}` }, { status: 500 })
  }

  // ---- AIの返信を保存 ----
  const aiInsert = supabase
    .from('chat_messages')
    .insert({ session_id, role: 'assistant', content: aiReplyContent })
    .select()

  const { data: aiMsgData } = (await aiInsert) as { data: any[] }
  const aiMessage = aiMsgData[0]

  // ---- message_count を +1 ----
  await supabase
    .from('chat_sessions')
    .update({ message_count: session.message_count + 1, updated_at: new Date().toISOString() })
    .eq('id', session_id)

  // ---- レスポンス ----
  return NextResponse.json({
    userMessage: { id: userMessage.id, role: 'user', content: userMessage.content, created_at: userMessage.created_at },
    aiMessage:   { id: aiMessage.id,   role: 'assistant', content: aiMessage.content, created_at: aiMessage.created_at },
    message_count: session.message_count + 1,
  })
}
