import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { callAIStream } from '@/lib/ai'

export const dynamic = 'force-dynamic'

const MAX_MESSAGES = 50

/**
 * POST /api/chat/[slug]/messages
 * メッセージ送信＋AI返信（SSEストリーミング）
 * Body: { session_id, content }
 *
 * SSEイベント：
 *   event: userMessage  → 生徒メッセージの保存結果
 *   event: chunk        → AIの返信テキスト（途中）
 *   event: done         → AIメッセージの保存結果 + message_count
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { session_id, content } = await req.json()

  if (!session_id || !content) {
    return new Response(
      JSON.stringify({ error: 'session_id と content が必要です' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ---- セッション検証 ----
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', session_id)
    .single() as { data: any }

  if (!session) {
    return new Response(
      JSON.stringify({ error: 'セッションが見つかりません' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (session.status !== 'active') {
    return new Response(
      JSON.stringify({ error: '会話は終了しています' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (session.message_count >= MAX_MESSAGES) {
    return new Response(
      JSON.stringify({ error: '会話の上限に達しています' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ---- config（先生設定）を取得 ----
  const { data: config } = await supabase
    .from('chat_configs')
    .select('*')
    .eq('id', session.config_id)
    .single() as { data: any }

  if (!config) {
    return new Response(
      JSON.stringify({ error: '設定データが見つかりません' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ---- 生徒のメッセージを保存 ----
  const { data: userMsgData } = (await supabase
    .from('chat_messages')
    .insert({ session_id, role: 'user', content })
    .select()) as { data: any[] }

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

【テーマ】${config.theme}
【アプローチ方法や会話の中で重視すべき点】${config.approach}
【会話を進める中で生徒に到達して欲しいゴール像】${config.important_points}
※ ゴール像は生徒には明示せず、自然な会話の中で生徒がこの状態に近づけるようサポートしてください

【重要な制約】
- 回答は簡潔に、2-3段落（200文字程度）以内にまとめてください
- 生徒が理解しやすいよう、ポイントを絞って説明してください
- 必要に応じて質問を1つ返し、対話を続けてください`
  
  if (config.source_text) {
    systemPrompt += `\n\n【参照資料】\n${config.source_text}`
  }

  // ---- OpenAI ストリーム開始 ----
  let aiStream: Response
  try {
    aiStream = await callAIStream({
      systemPrompt,
      messages: history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `AI返信に失敗しました: ${err.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ---- SSEストリーム構築 ----
  const sseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      // ① userMessage イベントを送信
      controller.enqueue(encoder.encode(
        `event: userMessage\ndata: ${JSON.stringify({
          id: userMessage.id,
          role: 'user',
          content: userMessage.content,
          created_at: userMessage.created_at,
        })}\n\n`
      ))

      // ② OpenAI ストリームを読み取り、chunk イベントを順次送信
      const reader = aiStream.body!.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.slice(6))
              const delta = json.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                controller.enqueue(encoder.encode(
                  `event: chunk\ndata: ${JSON.stringify(delta)}\n\n`
                ))
              }
            } catch (_e) {
              // malformed line はスキップ
            }
          }
        }
      }

      // ③ AI メッセージを DB に保存
      const { data: aiMsgData } = (await supabase
        .from('chat_messages')
        .insert({ session_id, role: 'assistant', content: fullContent })
        .select()) as { data: any[] }

      const aiMessage = aiMsgData[0]

      // ④ message_count を +1
      await supabase
        .from('chat_sessions')
        .update({ message_count: session.message_count + 1, updated_at: new Date().toISOString() })
        .eq('id', session_id)

      // ⑤ done イベントを送信
      controller.enqueue(encoder.encode(
        `event: done\ndata: ${JSON.stringify({
          aiMessage: {
            id: aiMessage.id,
            role: 'assistant',
            content: aiMessage.content,
            created_at: aiMessage.created_at,
          },
          message_count: session.message_count + 1,
        })}\n\n`
      ))

      controller.close()
    },
  })

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
