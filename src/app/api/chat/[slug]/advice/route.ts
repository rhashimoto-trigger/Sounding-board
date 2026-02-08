import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.GPT_API_KEY!,
})

/**
 * POST /api/chat/[slug]/advice
 * 会話を整理（要約・アドバイス・次のステップ生成）
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
    .select('*, chat_configs(theme, approach, important_points)')
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

  const config = session.chat_configs
  const theme = config?.theme || 'テーマ不明'
  const approach = config?.approach || ''
  const goal = config?.important_points || ''

  // プロンプト作成
  const prompt = `以下は「${theme}」についての生徒とAIの会話です。

【会話内容】
${conversation}

【先生の設定】
- アプローチ方法や会話の中で重視すべき点: ${approach}
- 会話を進める中で生徒に到達して欲しいゴール像: ${goal}

この会話を分析して、以下の3つの内容をJSON形式で出力してください：

{
  "summary": "【先生向け要約】会話の進捗を3-5文で要約。生徒が何を話し、どんなことを考えていて、どんな状態にあるかを先生が把握できるようまとめる。良い報告でなくてもOK。",
  "advice": "【生徒向け「これまでに話したこと」】会話の内容を整理・分析し、生徒自身が気づいていないかもしれない感情や考えも言語化して、生徒の気づきを促す（3-5文）",
  "next_hint": "【生徒向け「考えてみると良いこと」】ゴール像に近づくために、「advice」も踏まえて生徒が次に考えたり行動したりすると良いことを具体的に提案する。ただし、ゴール像そのものは明示しない（2-3文）"
}

※ JSONのみを出力し、他の説明は不要です`

  // OpenAI APIで整理
  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 2000,
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
    next_hint: result.next_hint,
  })
}
