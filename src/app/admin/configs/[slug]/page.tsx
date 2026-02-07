'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Config {
  id: string
  slug: string
  title: string
  theme: string
  approach: string
  important_points: string
  source_text: string | null
  allow_student_privacy_toggle: boolean
  created_at: string
}

interface Session {
  id: string
  grade: string
  class_name: string
  seat_number: string
  student_name: string
  message_count: number
  status: 'active' | 'paused' | 'completed'
  summary: string | null
  advice: string | null
  recovery_code: string
  created_at: string
  updated_at: string
}

interface MiningResult {
  keywords: string[]
  topics: { topic: string; count: number; description: string }[]
  trends: string
  concerns: string
}

// ステータスバッジのスタイル
const STATUS_STYLES: Record<string, string> = {
  active:    'bg-blue-50 text-blue-700',
  paused:    'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
}

const STATUS_LABELS: Record<string, string> = {
  active:    '会話中',
  paused:    '途中停止',
  completed: '完了',
}

export default function ConfigSessionsPage() {
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()

  const [config, setConfig] = useState<Config | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [miningResult, setMiningResult] = useState<MiningResult | null>(null)
  const [miningUpdatedAt, setMiningUpdatedAt] = useState<string | null>(null)
  const [isMining, setIsMining] = useState(false)
  const [showMining, setShowMining] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/configs/${slug}`).then((r) => r.json()),
      fetch(`/api/configs/${slug}/sessions`).then((r) => r.json()),
    ])
      .then(([configRes, sessionsRes]) => {
        if (configRes.error) {
          setError('データが見つかりません')
        } else {
          setConfig(configRes.config)
          setSessions(sessionsRes.sessions || [])
        }
        setIsLoading(false)
      })
      .catch(() => {
        setError('データの読み込みに失敗しました')
        setIsLoading(false)
      })
  }, [slug])

  // 新しい useEffect を追加
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

　// テキストマイニング実行
  const handleMining = async () => {
    setIsMining(true)
    setError('')

    try {
      const res = await fetch(`/api/configs/${slug}/mining`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'マイニングに失敗しました')
        setIsMining(false)
        return
      }

      setMiningResult(data.result)
      setMiningUpdatedAt(data.updated_at)
      setShowMining(true)
    } catch (err) {
      setError('マイニングに失敗しました')
    }

    setIsMining(false)
  }
  
  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // マイニング結果の取得
  useEffect(() => {
    if (config) {
      fetch(`/api/configs/${slug}/mining`)
        .then((r) => r.json())
        .then((data) => {
          if (data.result) {
            setMiningResult(data.result)
            setMiningUpdatedAt(data.updated_at)
          }
        })
        .catch(() => {})
    }
  }, [config, slug])

  // ローディング・エラー
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">{error || 'エラーが発生しました'}</p>
          <button onClick={() => router.push('/admin')} className="mt-3 text-primary-600 text-sm hover:underline">
            一覧へ戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">{config.title}</h1>
            <p className="text-xs text-gray-400">壁打ちくん</p>
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* パンくらず */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <button onClick={() => router.push('/admin')} className="hover:text-primary-600 transition-colors">一覧</button>
          <span>›</span>
          <span className="text-gray-600 font-medium">{config.title}</span>
        </div>

        {/* URL設定情報カード */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <div className="flex flex-col gap-1 mb-2">
                <span className="text-base font-bold text-gray-800">{config.title}</span>
                <span className="inline-block px-2.5 py-0.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full self-start">
                  {config.theme}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-xs font-mono">{origin}/chat/{config.slug}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(`${origin}/chat/${config.slug}`)
                  }}
                  className="shrink-0 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs rounded-lg transition-colors"
                >
                  コピー
                </button>
              </div>
            </div>
            <span className="text-gray-400 text-xs shrink-0">{formatDate(config.created_at)}</span>
          </div>

          {/* 設定詳細（折りたたみ可能） */}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-primary-600 hover:text-primary-700 font-medium">
              設定内容を表示
            </summary>
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
              {/* アプローチ */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">アプローチ</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{config.approach}</p>
              </div>

              {/* 重視すべき点 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">重視すべき点</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{config.important_points}</p>
              </div>

              {/* ソース（ある場合のみ） */}
              {config.source_text && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">ソース</p>
                  <details className="bg-gray-50 rounded-lg border border-gray-200">
                    <summary className="px-3 py-2 cursor-pointer text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      参照資料を表示（{config.source_text.length}文字）
                    </summary>
                    <div className="px-3 pb-3 pt-1">
                      <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {config.source_text}
                      </p>
                    </div>
                  </details>
                </div>
              )}

              {/* プライバシー設定 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">プライバシー設定</p>
                <p className="text-sm text-gray-700">
                  {config.allow_student_privacy_toggle 
                    ? '✓ 生徒が会話の表示/非表示を選択できます' 
                    : '× 先生は常に会話を閲覧できます'}
                </p>
              </div>
            </div>
          </details>
        </div>
        {/* テキストマイニングセクション */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-700">テキストマイニング</h2>
            <button
              onClick={handleMining}
              disabled={isMining || sessions.length === 0}
              className="px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {isMining ? '分析中...' : miningResult ? '再分析する' : '分析を実行'}
            </button>
          </div>

          {miningResult ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-400">
                  最終更新: {miningUpdatedAt ? new Date(miningUpdatedAt).toLocaleString('ja-JP') : '-'}
                </p>
                <button
                  onClick={() => setShowMining(!showMining)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  {showMining ? '閉じる' : '詳細を表示'}
                </button>
              </div>

              {showMining && (
                <div className="space-y-4">
                  {/* 頻出キーワード */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      頻出キーワード
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {miningResult.keywords.map((kw, i) => (
                        <span key={i} className="inline-block px-3 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 主なトピック */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      主なトピック
                    </h3>
                    <div className="space-y-2">
                      {miningResult.topics.map((t, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-800">{t.topic}</span>
                            <span className="text-xs text-gray-500">{t.count}人</span>
                          </div>
                          <p className="text-xs text-gray-600">{t.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 全体的な傾向 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      全体的な傾向
                    </h3>
                    <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">{miningResult.trends}</p>
                  </div>

                  {/* 気になる点 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      気になる点
                    </h3>
                    <p className="text-sm text-gray-700 bg-yellow-50 rounded-lg p-3">{miningResult.concerns}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 border-dashed p-8 text-center">
              <p className="text-gray-500 text-sm">
                {sessions.length === 0 
                  ? 'まだ生徒のチャットがありません' 
                  : '「分析を実行」ボタンを押すと、全生徒の会話を分析します'}
              </p>
            </div>
          )}
        </div>

        {/* 生徒一覧タイトル */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-700">
            生徒一覧
            <span className="ml-2 text-gray-400 font-normal text-sm">({sessions.length}人)</span>
          </h2>
        </div>

        {/* 生徒がいない場合 */}
        {sessions.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 border-dashed p-10 text-center">
            <p className="text-gray-500 text-sm">まだ生徒がこのURLにアクセスしていません</p>
          </div>
        )}

        {/* 生徒一覧 */}
        {sessions.length > 0 && (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/admin/configs/${slug}/sessions/${s.id}`)}
                className="bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-sm p-4 text-left transition-all group flex items-center gap-4"
              >
                {/* アバター */}
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <span className="text-primary-600 text-sm font-bold">
                    {s.student_name.charAt(0)}
                  </span>
                </div>

                {/* 生徒情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{s.student_name}</span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s.status]}`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {s.grade}年 {s.class_name}組 {s.seat_number}番 ・ {s.message_count}回やり取り ・ {formatDate(s.updated_at)}
                  </p>
                  {/* 復元コード */}
                  <p className="text-gray-400 text-xs mt-1">
                    復元コード: <span className="font-mono text-gray-600">{s.recovery_code}</span>
                  </p>
                </div>

                {/* 矢印 */}
                <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
