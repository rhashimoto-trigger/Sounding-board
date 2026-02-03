'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

// テーマのプレセット
const THEME_PRESETS = [
  { value: '進路相談', label: '進路相談' },
  { value: '探究テーマ相談', label: '探究テーマ相談' },
  { value: '学習方法の相談', label: '学習方法の相談' },
  { value: 'その他', label: 'その他（自由入力）' },
]

export default function CreateConfigPage() {
  const { data: session } = useSession()
  const router = useRouter()

  // フォーム値
  const [theme, setTheme] = useState('')
  const [customTheme, setCustomTheme] = useState('')
  const [approach, setApproach] = useState('')
  const [importantPoints, setImportantPoints] = useState('')
  const [sourceText, setSourceText] = useState('')

  // 状態
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedUrl, setGeneratedUrl] = useState('')  // 生成されたURL
  const [copied, setCopied] = useState(false)

  // テーマ値の取得（プレセットかカスタム）
  const getThemeValue = () => (theme === 'その他' ? customTheme : theme)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const themeValue = getThemeValue()

    // バリデーション
    if (!themeValue.trim()) {
      setError('テーマを入力してください')
      setIsLoading(false)
      return
    }
    if (!approach.trim()) {
      setError('アプローチを入力してください')
      setIsLoading(false)
      return
    }
    if (!importantPoints.trim()) {
      setError('重視すべき点を入力してください')
      setIsLoading(false)
      return
    }

    // API呼び出し
    const res = await fetch('/api/configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: themeValue.trim(),
        approach: approach.trim(),
        important_points: importantPoints.trim(),
        source_text: sourceText.trim() || null,
      }),
    })

    const data = await res.json()
    setIsLoading(false)

    if (!res.ok) {
      setError(data.error || 'エラーが発生しました')
      return
    }

    // 成功 → URLを表示
    const baseUrl = window.location.origin
    setGeneratedUrl(`${baseUrl}/chat/${data.config.slug}`)
  }

  // URLコピー
  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // URL生成成功後の画面
  if (generatedUrl) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-800">スタデイットチャット</h1>
            <span className="text-sm text-gray-500">{session?.user?.email}</span>
          </div>
        </header>

        {/* コンテンツ */}
        <main className="max-w-3xl mx-auto px-6 py-10">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            {/* アイコン */}
            <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-500 rounded-full mb-5">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-2">URL生成完了！</h2>
            <p className="text-gray-500 text-sm mb-6">以下のURLを生徒に共有してください</p>

            {/* 生成URL */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 mb-6">
              <span className="text-primary-600 font-mono text-sm truncate flex-1 text-left">
                {generatedUrl}
              </span>
              <button
                onClick={handleCopy}
                className="shrink-0 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {copied ? 'コピー済み ✓' : 'コピー'}
              </button>
            </div>

            {/* アクション */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-xl transition-colors"
              >
                一覧へ戻る
              </button>
              <button
                onClick={() => {
                  setGeneratedUrl('')
                  setTheme('')
                  setCustomTheme('')
                  setApproach('')
                  setImportantPoints('')
                  setSourceText('')
                }}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                もう一つ作成
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // フォーム画面
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">スタデイットチャット</h1>
          <span className="text-sm text-gray-500">{session?.user?.email}</span>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* パンクラム */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <button onClick={() => router.push('/admin')} className="hover:text-primary-600 transition-colors">一覧</button>
          <span>›</span>
          <span className="text-gray-600 font-medium">新規URL作成</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">新規URL作成</h2>
          <p className="text-gray-500 text-sm mb-6">生徒に共有するチャットURLの設計図を作成します</p>

          <form onSubmit={handleSubmit} noValidate>
            {/* テーマ */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                テーマ <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setTheme(preset.value)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border
                      ${theme === preset.value
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary-300'
                      }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {/* その他の場合は自由入力 */}
              {theme === 'その他' && (
                <input
                  type="text"
                  value={customTheme}
                  onChange={(e) => setCustomTheme(e.target.value)}
                  placeholder="テーマを自由に入力してください"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-800 placeholder-gray-400 text-sm"
                />
              )}
            </div>

            {/* アプローチ */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                アプローチ <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">どのような視点や考え方で相談を進めるか</p>
              <textarea
                value={approach}
                onChange={(e) => setApproach(e.target.value)}
                placeholder="例：生徒の価値観や興味を掘り下げ、自己理解を深める視点で対話する"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-800 placeholder-gray-400 text-sm resize-none"
              />
            </div>

            {/* 重視すべき点 */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                重視すべき点 <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">何を大切にすべきかを先生の視点で伝える</p>
              <textarea
                value={importantPoints}
                onChange={(e) => setImportantPoints(e.target.value)}
                placeholder="例：無理に答えを出さず、生徒が自分で考える時間を確保することが大切"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-800 placeholder-gray-400 text-sm resize-none"
              />
            </div>

            {/* ソース（オプション） */}
            <div className="mb-7">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ソース <span className="text-gray-400 font-normal">（オプション）</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">参照資料のテキストを貼り付けてください</p>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="ここに参照する資料のテキストを貼り付けてください"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-800 placeholder-gray-400 text-sm resize-none"
              />
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* ボタン */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isLoading || !theme}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-xl transition-colors shadow-md shadow-primary-200"
              >
                {isLoading ? 'URL生成中...' : 'URLを生成する'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="px-5 py-3 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
