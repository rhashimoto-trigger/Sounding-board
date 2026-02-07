import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.GPT_API_KEY!,
})

/**
 * POST /api/chat/[slug]/advice
 * 会話を整理（要約・アドバイス・次回のヒント生成）
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { session_id } = await req.json()

  if (!session_id) {
    return NextResponse.json({ error: 'セッションIDが必要です' }, { status: 400 })
  }

  // セッション取得
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*, chat_configs(theme)')
    .eq('id', session_id)
    .single() as { data: any }

  if (!session) {
    return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
  }

  // メッセージ取得
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true }) as { data: any[] }

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'まだ会話がありません' }, { status: 400 })
  }

  // 会話履歴を整形
  const conversation = messages
    .map((m) => `${m.role === 'user' ? '生徒' : 'AI'}: ${m.content}`)
    .join('\n\n')

  const theme = session.chat_configs?.theme || 'テーマ不明'
  const isNearLimit = session.message_count >= 45 // 上限近い

  // プロンプト作成
  let prompt = `以下は「${theme}」についての生徒とAIの会話です。

${conversation}

この会話を整理して、以下の形式のJSONで出力してください：

{
  "summary": "これまでの会話の要約（3-5文で、生徒が話した内容を中心に）",
  "advice": "考えてみると良いこと、AIからのアドバイス（3-5文で、具体的な提案や視点を）"`

  if (isNearLimit) {
    prompt += `,
  "next_hint": "次回のチャットで話すと良いこと（2-3文で、今回の続きとして何を掘り下げると良いか、どんな切り口で始めると良いかを提案）"`
  }

  prompt += `
}

※ JSONのみを出力し、他の説明は不要です`

  // OpenAI APIで整理
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1000,
  })

  const resultText = completion.choices[0].message.content || '{}'
  const result = JSON.parse(resultText)

  // DBに保存（statusは変更しない）
  const { error } = await supabase
    .from('chat_sessions')
    .update({
      summary: result.summary,
      advice: result.advice,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session_id)

  if (error) {
    return NextResponse.json({ error: 'データの保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({
    summary: result.summary,
    advice: result.advice,
    next_hint: result.next_hint || null,
  })
}
