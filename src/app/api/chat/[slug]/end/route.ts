import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { callAI } from '@/lib/ai'

/**
 * POST /api/chat/[slug]/end
 * 途中終了処理
 * Body: { session_id }
 * 
 * 処理順：
 *   1. セッションを検証
 *   2. 会話履歴を取得
 *   3. AIで要約を生成
 *   4. summary を保存・status を paused へ
 *   5. レスポンスに recovery_code を返す
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { session_id } = await req.json()

  if (!session_id) {
    return NextResponse.json({ error: 'session_id が必要です' }, { status: 400 })
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
    return NextResponse.json({ error: '会話は既に終了しています' }, { status: 400 })
  }

  // ---- 会話履歴を取得 ----
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true }) as { data: { role: string; content: string }[] }

  // ---- AIで要約を生成 ----
  let summary = ''

  if (messages && messages.length > 0) {
    // 会話履歴をテキスト整理
    const conversationText = messages
      .map((m) => (m.role === 'user' ? `生徒: ${m.content}` : `AI: ${m.content}`))
      .join('\n')

    const systemPrompt = `あなたは教育現場のAIアシスタントです。
以下の生徒とAIの会話を読んで、先生に向けて簡潔にまとめてください。

まとめる際の観点：
・生徒がどのような問いや悩みを持っていたか
・会話がどのような方向に進んだか
・生徒の気づきや考えの変化があればそれを含める
・客観的・中立的なトーンで書く

会話の長さに合わせて、3〜6文程度で要約してください。`

    try {
      summary = await callAI({
        systemPrompt,
        messages: [
          {
            role: 'user',
            content: `以下の会話を要約してください。\n\n${conversationText}`,
          },
        ],
      })
    } catch (err: any) {
      // 要約に失敗した場合は空で続行（会話停止は続行する）
      console.error('要約生成エラー:', err.message)
      summary = '要約の生成に失敗しました。会話内容は別途確認してください。'
    }
  }

  // ---- status を paused にし、summary を保存 ----
  await supabase
    .from('chat_sessions')
    .update({
      status: 'paused',
      summary: summary || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session_id)

  return NextResponse.json({
    recovery_code: session.recovery_code,
    summary,
  })
}
