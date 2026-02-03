'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useParams } from 'next/navigation'

// ---- 型定義 ----
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface SessionInfo {
  id: string
  recovery_code: string
  message_count: number
  status: string
  student_name: string
}

const MAX_MESSAGES = 50
const ADVICE_UNLOCK_ROUNDS = 3

// ---- ページの状態 ----
type PageState = 'entry' | 'input' | 'chat' | 'recovery-shown' | 'advice-shown'

export default function ChatPage() {
  const { slug } = useParams<{ slug: string }>()

  // ページ状態
  const [pageState, setPageState] = useState<PageState>('entry')

  // 入力フォーム
  const [grade, setGrade]             = useState('')
  const [className, setClassName]     = useState('')
  const [seatNumber, setSeatNumber]   = useState('')
  const [studentName, setStudentName] = useState('')

  // 復元コード入力
  const [recoveryInput, setRecoveryInput] = useState('')

  // アドバイス結果
  const [adviceResult, setAdviceResult] = useState<{ summary: string; advice: string } | null>(null)

  // セッション・メッセージ
  const [session, setSession]   = useState<SessionInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  // チャット入力
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  // エラー
  const [error, setError] = useState('')

  // スクロール参照
  const bottomRef = useRef<HTMLDivElement>(null)

  // メッセージ更新時に下にスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 残り回数
  const remaining = session ? MAX_MESSAGES - session.message_count : MAX_MESSAGES

  // アドバイスボタン表示条件
  const showAdviceBtn = session ? session.message_count >= ADVICE_UNLOCK_ROUNDS : false

  // ---- ハンドラ ----

  // 新規開始 → 入力画面へ
  const handleNewStart = () => {
    setError('')
    setPageState('input')
  }

  // 復元コード入力後 → セッション復元
  const handleRestore = async () => {
    if (!recoveryInput.trim()) {
      setError('復元コードを入力してください')
      return
    }
    setError('')
    setIsSending(true)

    const res = await fetch(`/api/chat/${slug}?recovery_code=${recoveryInput.trim()}`)
    const data = await res.json()

    setIsSending(false)

    if (!res.ok) {
      setError(data.error || '復元に失敗しました')
      return
    }

    setSession(data.session)
    setMessages(data.messages || [])
    setPageState('chat')
  }

  // フォーム送信 → セッション作成
  const handleInfoSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSending(true)

    const res = await fetch(`/api/chat/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade, class_name: className, seat_number: seatNumber, student_name: studentName }),
    })
    const data = await res.json()

    setIsSending(false)

    if (!res.ok) {
      setError(data.error || 'セッション作成に失敗しました')
      return
    }

    setSession(data.session)
    setMessages(data.messages || [])
    setPageState('chat')
  }

  // チャット送信 → AI返信
  const handleChatSend = async (e: any) => {
    e.preventDefault()
    if (!chatInput.trim() || isSending || !session) return
    setError('')
    setIsSending(true)

    const res = await fetch(`/api/chat/${slug}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, content: chatInput.trim() }),
    })
    const data = await res.json()

    setIsSending(false)

    if (!res.ok) {
      setError(data.error || 'メッセージ送信に失敗しました')
      return
    }

    setChatInput('')
    setMessages((prev) => [...prev, data.userMessage, data.aiMessage])
    setSession((prev) => prev ? { ...prev, message_count: data.message_count } : prev)
  }

  // 保存して退出する
  const handleEndSession = async () => {
    if (!session) return
    setIsSending(true)
    setError('')

    const res = await fetch(`/api/chat/${slug}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id }),
    })
    const data = await res.json()

    setIsSending(false)

    if (!res.ok) {
      setError(data.error || '保存に失敗しました')
      return
    }

    // 復元コード表示画面へ
    setPageState('recovery-shown')
  }

  // アドバイスを頂く
  const handleGetAdvice = async () => {
    if (!session) return
    setIsSending(true)
    setError('')

    const res = await fetch(`/api/chat/${slug}/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id }),
    })
    const data = await res.json()

    setIsSending(false)

    if (!res.ok) {
      setError(data.error || 'アドバイス生成に失敗しました')
      return
    }

    setAdviceResult({ summary: data.summary, advice: data.advice })
    setPageState('advice-shown')
  }

  // 時刻フォーマット
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  // ============================================================
  // ① エントリ画面（新規 or 復元の選択）
  // ============================================================
  if (pageState === 'entry') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* ロゴ */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">スタデイットチャット</h1>
            <p className="text-gray-500 text-sm mt-1">先生のチャットに参加してください</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* 新規開始 */}
            <button
              onClick={handleNewStart}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-md shadow-primary-200 mb-3"
            >
              新規で開始する
            </button>

            {/* 区切り */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-xs">または</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* 復元コード入力 */}
            <p className="text-gray-600 text-sm font-medium mb-2">途中から続ける場合</p>
            <input
              type="text"
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
              placeholder="復元コード（例: R-A1B2C3D4）"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-gray-800 placeholder-gray-400 text-sm mb-3"
            />
            <button
              onClick={handleRestore}
              disabled={isSending}
              className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors text-sm"
            >
              {isSending ? '復元中...' : '復元する'}
            </button>

            {/* エラー */}
            {error && (
              <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // ② 情報入力画面
  // ============================================================
  if (pageState === 'input') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* ロゴ */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-3 shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800">あなたの情報を入力してください</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleInfoSubmit} noValidate>
              {/* 学年・クラス・出席番号は1行に並べる */}
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">学年</label>
                  <input
                    type="text"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="3"
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 text-sm text-center"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">クラス</label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="A"
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 text-sm text-center"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">出席番号</label>
                  <input
                    type="text"
                    value={seatNumber}
                    onChange={(e) => setSeatNumber(e.target.value)}
                    placeholder="12"
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 text-sm text-center"
                  />
                </div>
              </div>

              {/* 氏名 */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-600 mb-1">氏名</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="田中太郎"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 text-sm"
                />
              </div>

              {/* エラー */}
              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* ボタン */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-xl transition-colors"
                >
                  {isSending ? '開始中...' : 'チャットを開始する'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPageState('entry'); setError('') }}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-xl transition-colors"
                >
                  戻る
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // ③ 復元コード表示画面（保存して退出した後）
  // ============================================================
  if (pageState === 'recovery-shown' && session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-yellow-100 rounded-full mb-4">
              <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">保存して退出しました</h2>
            <p className="text-gray-500 text-sm mb-5">次回続けるときは、以下の復元コードを使ってください</p>

            {/* 復元コード */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 mb-5">
              <p className="text-xs text-gray-400 mb-1">復元コード</p>
              <p className="text-xl font-bold font-mono text-gray-800 tracking-widest">{session.recovery_code}</p>
            </div>

            <p className="text-gray-400 text-xs mb-5">このコードをメモしておいてください</p>

            <button
              onClick={() => { setPageState('entry'); setRecoveryInput(''); setError('') }}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              トップに戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // ④ アドバイス表示画面（アドバイスを頂いた後）
  // ============================================================
  if (pageState === 'advice-shown' && adviceResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* アイコン */}
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-3">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-800">アドバイス</h2>
              <p className="text-gray-500 text-sm mt-0.5">以下があなたへのアドバイスです</p>
            </div>

            {/* 要約 */}
            {adviceResult.summary && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-blue-700 text-xs font-semibold">会話の要約</span>
                </div>
                <p className="text-blue-800 text-sm leading-relaxed">{adviceResult.summary}</p>
              </div>
            )}

            {/* アドバイス */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-green-700 text-xs font-semibold">アドバイス</span>
              </div>
              <p className="text-green-800 text-sm leading-relaxed">{adviceResult.advice}</p>
            </div>

            {/* 閉じる */}
            <button
              onClick={() => { setPageState('entry'); setRecoveryInput(''); setError('') }}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // ⑤ チャット画面
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-800">スタデイットチャット</h1>
            <p className="text-xs text-gray-400">{session?.student_name} さん</p>
          </div>
          {/* 残り回数バッジ */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
              ${remaining <= 10 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              残り {remaining} 回
            </span>
          </div>
        </div>
      </header>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-3">
          {/* 開始メッセージ */}
          {messages.length === 0 && (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">チャットを開始してください</p>
            </div>
          )}

          {/* メッセージ一覧 */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* アバター */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                ${msg.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-600'}`}
              >
                {msg.role === 'user' ? (session?.student_name.charAt(0) ?? '生') : 'AI'}
              </div>

              {/* バブル */}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3
                ${msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-right text-primary-200' : 'text-left text-gray-400'}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}

          {/* 送信中インディケーター */}
          {isSending && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <span className="text-gray-600 text-xs font-bold">AI</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-gray-400 text-sm">返信中...</p>
              </div>
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* スクロール先のアンカー */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ボタン・入力エリア */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto">

          {/* アドバイス・保存退出ボタン */}
          <div className={`flex gap-2 mb-3 ${showAdviceBtn ? '' : 'justify-end'}`}>
            {showAdviceBtn && (
              <button
                onClick={handleGetAdvice}
                disabled={isSending}
                className="flex-1 sm:flex-none sm:px-5 py-2 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {isSending ? '生成中...' : 'アドバイスを頂く'}
              </button>
            )}
            <button
              onClick={handleEndSession}
              disabled={isSending}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-600 text-sm font-medium rounded-xl transition-colors"
            >
              {isSending ? '処理中...' : '保存して退出する'}
            </button>
          </div>

          {/* チャット入力フォーム */}
          <form onSubmit={handleChatSend} className="flex gap-2 items-end">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleChatSend(e)
                }
              }}
              placeholder="メッセージを入力してください（Shift+Enterで改行）"
              rows={2}
              disabled={isSending || remaining <= 0}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 placeholder-gray-400 text-sm disabled:bg-gray-50 disabled:text-gray-400 resize-none"
            />
            <button
              type="submit"
              disabled={isSending || !chatInput.trim() || remaining <= 0}
              className="px-5 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-xl transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l-1.41 1.41L16.59 11H4v2h12.59l-6 6L12 20l8-8z" />
              </svg>
            </button>
          </form>

          {/* 上限に達した場合 */}
          {remaining <= 0 && (
            <p className="text-center text-red-500 text-xs mt-2">
              会話の上限に達しました。アドバイスを頂くか、保存して退出してください。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
