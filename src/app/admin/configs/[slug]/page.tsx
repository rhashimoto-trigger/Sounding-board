'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Config {
  id: string
  slug: string
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
  const [error, setError] = useState('')

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
          <h1 className="text-lg font-bold text-gray-800">壁打ちくん</h1>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* パンクラム */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
          <button onClick={() => router.push('/admin')} className="hover:text-primary-600 transition-colors">一覧</button>
          <span>›</span>
          <span className="text-gray-600 font-medium">{config.theme}</span>
        </div>

        {/* URL設定情報カード */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-block px-2.5 py-0.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full">
                {config.theme}
              </span>
              <span className="text-gray-400 text-xs font-mono">/chat/{config.slug}</span>
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
