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
