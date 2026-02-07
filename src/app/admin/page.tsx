'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Config {
  id: string
  slug: string
  title: string
  theme: string
  approach: string
  important_points: string
  source_text: string | null
  created_at: string
}

export default function AdminPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [configs, setConfigs] = useState<Config[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [origin, setOrigin] = useState('')
  const [copiedSlug, setCopiedSlug] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    fetch('/api/configs')
      .then((res) => res.json())
      .then((data) => {
        setConfigs(data.configs || [])
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  // 日付フォーマット
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // URL コピー
  const handleCopyUrl = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(`${origin}/chat/${slug}`)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(''), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">壁打ちくん</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">{session?.user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* コンテンツ */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* タイトルバー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">URL一覧</h2>
            <p className="text-gray-500 text-sm mt-0.5">生徒に共有するチャットURLを管理する</p>
          </div>
          <button
            onClick={() => router.push('/admin/create')}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm shadow-primary-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規作成
          </button>
        </div>

        {/* ローディング */}
        {isLoading && (
          <div className="text-center py-16 text-gray-400 text-sm">読み込み中...</div>
        )}

        {/* 空状態 */}
        {!isLoading && configs.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 border-dashed p-12 text-center">
            <div className="text-gray-300 text-4xl mb-3">📎</div>
            <p className="text-gray-500 font-medium">まだURLが作成されていません</p>
            <p className="text-gray-400 text-sm mt-1 mb-4">「新規作成」ボタンから最初のURLを作ってみましょう</p>
            <button
              onClick={() => router.push('/admin/create')}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              新規URL作成
            </button>
          </div>
        )}

        {/* URL一覧 */}
        {!isLoading && configs.length > 0 && (
          <div className="flex flex-col gap-3">
            {configs.map((config) => (
              <div
                key={config.id}
                onClick={() => router.push(`/admin/configs/${config.slug}`)}
                className="bg-white rounded-2xl border border-gray-200 hover:border-primary-300 hover:shadow-sm p-5 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* 左側：テーマ・URL */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-bold text-gray-800 text-sm">{config.title}</span>
                      <span className="inline-block px-2.5 py-0.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full self-start">
                        {config.theme}
                      </span>
                    </div>
                    {/* URL + コピーボタン */}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-gray-500 text-xs font-mono truncate">
                        {origin}/chat/{config.slug}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => handleCopyUrl(e, config.slug)}
                        className="shrink-0 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs rounded-lg transition-colors"
                      >
                        {copiedSlug === config.slug ? 'コピー済み✓' : 'コピー'}
                      </button>
                    </div>
                  </div>

                  {/* 右側：日付・矢印 */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-400 text-xs">{formatDate(config.created_at)}</span>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
