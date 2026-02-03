/**
 * 生成AI APIの呼び出し
 * 環境変数 AI_API_KEY / AI_API_BASE_URL を使用
 * 
 * @param systemPrompt  - システムプロンプト（先生設定の情報など）
 * @param messages      - 会話履歴（role: user/assistant）
 * @returns AIの返信テキスト
 */
export async function callAI({
  systemPrompt,
  messages,
}: {
  systemPrompt: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}): Promise<string> {
  const apiKey = process.env.AI_API_KEY
  const apiBaseUrl = process.env.AI_API_BASE_URL

  if (!apiKey || !apiBaseUrl) {
    throw new Error('AI_API_KEY または AI_API_BASE_URL が設定されていません')
  }

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',                    // ← 使うモデル名はここで変更してください
      temperature: 0.7,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`AI API エラー (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('AI APIから返信がありませんでした')
  }

  return content as string
}
