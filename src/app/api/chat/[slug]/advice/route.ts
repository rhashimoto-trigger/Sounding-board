import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { callAI } from '@/lib/ai'

const ADVICE_UNLOCK_ROUNDS = 3

// ---- テーマごとのアドバイスプロンプト ----
function getAdvicePrompt(theme: string, contextInfo: string): string {
  if (theme === '進路相談') {
    return `あなたは高等学校の生徒に対応するAIアドバイザーです。
以下の先生の設定と、会話の内容を読んで、生徒に向けたアドバイスを作成してください。

${contextInfo}

このテーマは「進路相談」なので、以下の項目を会話から読み取り、生徒の言葉で言語化してあげてください。

【強み】
・生徒の言葉や態度から感じ取れる長所や得意なこと
・本人も気づいていなかった強みがあればそれも含める

【考え方】
・生徒がどのように物事を捉えているか、思考のパターン
・何を大切にして、何を気にしているか

【価値観】
・会話の裏側にある、生徒にとっての「大切なもの」や「こうしたい」という気持ち

【おすすめの学部（2〜3つ）】
・上記の強み・考え方・価値観に合わせて、具体的な学部名を挙げる
・なぜその学部が合っているのか、理由も添える
・幅広く考えてもらえるよう、異なる視点の学部も含める

【おすすめの職業（2〜3つ）】
・上記の強み・考え方・価値観に合わせて、具体的な職業名を挙げる
・なぜその職業が合っているのか、理由も添える
・「あくまで一つの視点」であることを添えて、生徒が自分で考え続けられるようにする

書き方のポイント：
・温かみのある、親しみやすい日本語で書く
・生徒が読んで「そうか、自分はこう感じていたんだな」と思えるような書き方にする
・学部や職業はあくまで「一つの提案」であることを明確にし、プレッシャーを与えない
・全体で400〜600字程度で書く`
  }

  // デフォルト（その他のテーマ）
  return `あなたは高等学校の生徒に対応するAIアドバイザーです。
以下の先生の設定と、会話の要約を読んで、生徒に向けたアドバイスを作成してください。

${contextInfo}

アドバイスのポイント：
・生徒の言葉や問いに正直に向き合う
・無理に答えを決めず、生徒が自分で考える手助けに徹する
・次のアクション（考えるべき問い・調べるべき事など）も提案する
・温かみのある、親しみやすい日本語で書く
・200〜400字程度で書く`
}

/**
 * POST /api/chat/[slug]/advice
 * アドバイス生成＋会話完了
 * Body: { session_id }
 *
 * 処理順：
 *   1. セッション検証（active・3往復以上）
 *   2. 会話履歴を取得
 *   3. AIで要約を生成
 *   4. AIでアドバイスを生成（テーマに応じたプロンプト）
 *   5. summary・advice を保存・status を completed へ
 *   6. レスポンスに summary・advice を返す
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

  if (session.message_count < ADVICE_UNLOCK_ROUNDS) {
    return NextResponse.json({ error: `${ADVICE_UNLOCK_ROUNDS}往復以上してからアドバイスを頂いてください` }, { status: 400 })
  }

  // ---- config（先生設定）を取得 ----
  const { data: config } = await supabase
    .from('chat_configs')
    .select('*')
    .eq('id', session.config_id)
    .single() as { data: any }

  // ---- 会話履歴を取得 ----
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true }) as { data: { role: string; content: string }[] }

  // 会話履歴をテキスト整理
  const conversationText = (messages || [])
    .map((m) => (m.role === 'user' ? `生徒: ${m.content}` : `AI: ${m.content}`))
    .join('\n')

  // ---- ① 要約を生成 ----
  let summary = ''
  try {
    summary = await callAI({
      systemPrompt: `あなたは教育現場のAIアシスタントです。
以下の生徒とAIの会話を読んで、先生に向けて簡潔にまとめてください。

まとめる際の観点：
・生徒がどのような問いや悩みを持っていたか
・会話がどのような方向に進んだか
・生徒の気づきや考えの変化があればそれを含める
・客観的・中立的なトーンで書く
・全ての会話が完璧ではないので、納得などしていなさそうであれば、その様子も伝えてください

会話の長さに合わせて、3〜6文程度で要約してください。`,
      messages: [
        {
          role: 'user',
          content: `以下の会話を要約してください。\n\n${conversationText}`,
        },
      ],
    })
  } catch (err: any) {
    console.error('要約生成エラー:', err.message)
    summary = '要約の生成に失敗しました。会話内容は別途確認してください。'
  }

  // ---- ② アドバイスを生成（テーマに応じたプロンプト） ----
  let advice = ''
  try {
    // 先生設定の情報を含めたコンテキスト
    let contextInfo = `【テーマ】${config?.theme || '未設定'}
【アプローチ】${config?.approach || '未設定'}
【重視すべき点】${config?.important_points || '未設定'}`

    if (config?.source_text) {
      contextInfo += `\n【参照資料】${config.source_text}`
    }

    // テーマに応じたプロンプトを取得
    const adviceSystemPrompt = getAdvicePrompt(config?.theme || '', contextInfo)

    advice = await callAI({
      systemPrompt: adviceSystemPrompt,
      messages: [
        {
          role: 'user',
          content: `以下の会話の要約と詳細を読んで、生徒へのアドバイスを作成してください。\n\n【会話の要約】\n${summary}\n\n【会話の詳細】\n${conversationText}`,
        },
      ],
    })
  } catch (err: any) {
    console.error('アドバイス生成エラー:', err.message)
    advice = 'アドバイスの生成に失敗しました。先生に相談してください。'
  }

  // ---- summary・advice を保存・status を completed へ ----
  await supabase
    .from('chat_sessions')
    .update({
      status: 'completed',
      summary: summary || null,
      advice:  advice  || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session_id)

  return NextResponse.json({ summary, advice })
}
