'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface SessionDetail {
  session: {
    id: string
    grade: string
    class_name: string
    seat_number: string
    student_name: string
    message_count: number
    status: 'active' | 'paused' | 'completed'
    summary: string | null
    advice: string | null
    created_at: string
    updated_at: string
  }
  config: {
    id: string
    slug: string
    theme: string
  }
  messages: {
    id: string
    role: 'user' | 'assistant'
    content: string
    created_at: string
  }[]
}

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

export default function SessionDetailPage() {
  const router = useRouter()
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>()
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setDetail(data)
        }
        setIsLoading(false)
      })
      .catch(() => {
        setError('データの読み込みに失敗しました')
        setIsLoading(false)
      })
  }, [sessionId])

  // 時刻フォーマット
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  // ローディング・エラー
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    )
  }

  if (error || !detail) {
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

  const { session, config, messages } = detail

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
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 flex-wrap">
          <button onClick={() => router.push('/admin')} className="hover:text-primary-600 transition-colors">一覧</button>
          <span>›</span>
          <button onClick={() => router.push(`/admin/configs/${slug}`)} className="hover:text-primary-600 transition-colors">{config.theme}</button>
          <span>›</span>
          <span className="text-gray-600 font-medium">{session.student_name}</span>
        </div>

        {/* 生徒情報カード */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <div className="flex items-center gap-4">
            {/* アバター */}
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <span className="text-primary-600 font-bold text-lg">{session.student_name.charAt(0)}</span>
            </div>
            {/* 情報 */}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-800">{session.student_name}</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[session.status]}`}>
                  {STATUS_LABELS[session.status]}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                {session.grade}年 {session.class_name}組 {session.seat_number}番 ・ {session.message_count}回やり取り
              </p>
            </div>
          </div>
        </div>

        {/* 要約・アドバイスセクション */}
        {(session.summary || session.advice) && (
          <div className="mb-6">
            {session.summary && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-blue-700 text-sm font-semibold">要約</span>
                </div>
                <p className="text-blue-800 text-sm leading-relaxed">{session.summary}</p>
              </div>
            )}
            {session.advice && (
              <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-green-700 text-sm font-semibold">アドバイス</span>
                </div>
                <p className="text-green-800 text-sm leading-relaxed">{session.advice}</p>
              </div>
            )}
          </div>
        )}

        {/* まだ要約がない場合 */}
        {!session.summary && !session.advice && (
          <div className="bg-gray-100 rounded-2xl border border-gray-200 p-4 mb-6 text-center">
            <p className="text-gray-500 text-sm">まだ要約やアドバイスが生成されていません</p>
          </div>
        )}

        {/* チャットログ */}
        <div className="mb-2">
          <h3 className="text-sm font-bold text-gray-600 mb-3">チャットログ</h3>
        </div>

        {messages.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">メッセージがありません</div>
        )}

        {messages.length > 0 && (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* アバター */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                  ${msg.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-600'}`}
                >
                  {msg.role === 'user' ? session.student_name.charAt(0) : 'AI'}
                </div>

                {/* バブル */}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3
                  ${msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 text-right ${msg.role === 'user' ? 'text-primary-200' : 'text-gray-400'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
