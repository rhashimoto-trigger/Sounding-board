import { NextResponse, NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.AI_API_KEY!,
})

/**
 * GET /api/configs/[slug]/mining
 * 保存済みのマイニング結果を取得
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  // 認証チェック
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })
  if (!token?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data: config } = await supabase
    .from('chat_configs')
    .select('mining_result, mining_updated_at')
    .eq('slug', params.slug)
    .eq('teacher_id', token.id as string)
    .single() as { data: any }

  if (!config) {
    return NextResponse.json({ error: 'URLが見つかりません' }, { status: 404 })
  }

  return NextResponse.json({
    result: config.mining_result,
    updated_at: config.mining_updated_at,
  })
}

/**
 * 会話履歴から要約を生成
 */
async function generateSummary(sessionId: string, theme: string): Promise<string> {
  // メッセージを取得
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true }) as { data: any[] }

  if (!messages || messages.length === 0) {
    return '（会話なし）'
  }

  // 会話履歴を整形
  const conversation = messages
    .map((m) => `${m.role === 'user' ? '生徒' : 'AI'}: ${m.content}`)
    .join('\n\n')

  // Claude APIで要約生成
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `以下は「${theme}」についての生徒とAIの会話です。この会話を3-5文で要約してください。生徒の主な悩みや関心事、相談内容を中心にまとめてください。

${conversation}`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : '（要約失敗）'
}

/**
 * POST /api/configs/[slug]/mining
 * テキストマイニングを実行
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  // 認証チェック
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })
  if (!token?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // configを取得
  const { data: config } = await supabase
    .from('chat_configs')
    .select('id, title, theme')
    .eq('slug', params.slug)
    .eq('teacher_id', token.id as string)
    .single() as { data: any }

  if (!config) {
    return NextResponse.json({ error: 'URLが見つかりません' }, { status: 404 })
  }

  // 全セッションを取得
  const { data: allSessions } = await supabase
    .from('chat_sessions')
    .select('id, grade, class_name, seat_number, student_name, summary, status, message_count')
    .eq('config_id', config.id)
    .gt('message_count', 0) as { data: any[] }

  if (!allSessions || allSessions.length === 0) {
    return NextResponse.json({ error: 'まだ会話がありません' }, { status: 400 })
  }

  // 要約がないセッションに対して要約を生成
  const sessionsWithoutSummary = allSessions.filter((s) => !s.summary)
  
  for (const session of sessionsWithoutSummary) {
    try {
      const summary = await generateSummary(session.id, config.theme)
      
      // summaryだけ更新、statusは変更しない
      await supabase
        .from('chat_sessions')
        .update({ summary })
        .eq('id', session.id)
      
      // ローカルのセッション情報も更新
      session.summary = summary
    } catch (error) {
      console.error(`Failed to generate summary for session ${session.id}:`, error)
      session.summary = '（要約生成失敗）'
    }
  }

  // 全セッションの要約をまとめる
  const summariesText = allSessions
    .map((s, i) => `【生徒${i + 1}】${s.grade}年${s.class_name}組${s.seat_number}番 ${s.student_name}\n${s.summary || '（要約なし）'}`)
    .join('\n\n---\n\n')

  // Claude APIでマイニング
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `以下は「${config.title}」（テーマ: ${config.theme}）というチャットセッションの全${allSessions.length}人分の要約です。

${summariesText}

これらの要約を分析して、以下の情報をJSON形式で出力してください：

{
  "keywords": ["キーワード1", "キーワード2", ...],
  "topics": [
    {"topic": "トピック名", "count": 人数, "description": "簡単な説明"}
  ],
  "trends": "全体的な傾向や特徴を2-3文で",
  "concerns": "先生が気をつけるべき点や気になる傾向を2-3文で"
}

※ keywordsは名詞・動詞を中心に、学生の悩みや関心を表すものを選んでください（最大10個）
※ topicsは具体的なテーマ（例：進路の選択、人間関係の悩み、学習方法など）を多い順に最大5つ
※ JSONのみを出力し、他の説明は不要です`,
      },
    ],
  })

  const resultText = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const miningResult = JSON.parse(resultText)

  // DBに保存
  const { error } = await supabase
    .from('chat_configs')
    .update({
      mining_result: miningResult,
      mining_updated_at: new Date().toISOString(),
    })
    .eq('id', config.id)

  if (error) {
    return NextResponse.json({ error: 'マイニング結果の保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({
    result: miningResult,
    updated_at: new Date().toISOString(),
    summaries_generated: sessionsWithoutSummary.length,
  })
}
