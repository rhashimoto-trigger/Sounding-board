'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

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
  summary: string | null
  advice: string | null
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
  const [isComposing, setIsComposing] = useState(false)

  // ストリーミング中のAIメッセージID
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  // アドバイス閉じる時の警告モーダル
  const [showCloseWarning, setShowCloseWarning] = useState(false)

  // コピー完了フィードバック
  const [copied, setCopied] = useState(false)

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

  // アドバイスボタン表示条件（completed済みの場合は非表示）
  const showAdviceBtn = session
    ? session.message_count >= ADVICE_UNLOCK_ROUNDS && session.status === 'active'
    : false

  // 会話完了・アドバイス済みかどうか（復元時に「見る」バナーを出す判定）
  const isCompleted = session?.status === 'completed' && session?.advice

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

    // 完了済みで advice がある場合はアドバイス画面へ直接
    if (data.session.status === 'completed' && data.session.advice) {
      setAdviceResult({ summary: data.session.summary || '', advice: data.session.advice })
      setPageState('advice-shown')
    } else {
      setPageState('chat')
    }
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

  // チャット送信 → AIストリーミング返信
  const handleChatSend = async (e: any) => {
    e.preventDefault()
    if (!chatInput.trim() || isSending || !session) return

    const currentInput = chatInput.trim()
    setChatInput('')
    setError('')
    setIsSending(true)

    const tempUserId = 'temp-user-' + Date.now()
    const tempAiId   = 'temp-ai-' + Date.now()

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: 'user',      content: currentInput, created_at: new Date().toISOString() },
      { id: tempAiId,   role: 'assistant', content: '',           created_at: new Date().toISOString() },
    ])
    setStreamingMessageId(tempAiId)

    try {
      const res = await fetch(`/api/chat/${slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, content: currentInput }),
      })

      if (!res.ok || !res.body) {
        setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempAiId))
        const data = await res.json()
        setError(data.error || 'メッセージ送信に失敗しました')
        setStreamingMessageId(null)
        setIsSending(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()

            if (currentEvent === 'userMessage') {
              const userMsg = JSON.parse(data)
              setMessages((prev) => prev.map((m) => m.id === tempUserId ? userMsg : m))
            } else if (currentEvent === 'chunk') {
              const chunkText: string = JSON.parse(data)
              setMessages((prev) => prev.map((m) =>
                m.id === tempAiId ? { ...m, content: m.content + chunkText } : m
              ))
            } else if (currentEvent === 'done') {
              const { aiMessage, message_count } = JSON.parse(data)
              setMessages((prev) => prev.map((m) => m.id === tempAiId ? aiMessage : m))
              setSession((prev) => prev ? { ...prev, message_count } : prev)
            }

            currentEvent = ''
          }
        }
      }
    } catch (_err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId && m.id !== tempAiId))
      setError('メッセージ送信に失敗しました')
    }

    setStreamingMessageId(null)
    setIsSending(false)
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
    // セッション情報も更新（アドバイス済みにする）
    setSession((prev) => prev ? { ...prev, status: 'completed', advice: data.advice, summary: data.summary } : prev)
    setPageState('advice-shown')
  }

  // アドバイスのコピー
  const handleCopyAdvice = () => {
    if (!adviceResult) return
    navigator.clipboard.writeText(adviceResult.advice)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">壁打ちくん</h1>
            <p className="text-gray-500 text-sm mt-1">先生のチャットに参加してください</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <button
              onClick={handleNewStart}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-md shadow-primary-200 mb-3"
            >
              新規で開始する
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-400 text-xs">または</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

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
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">学年</label>
                  <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="3" required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 text-sm text-center" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">クラス</label>
                  <input type="text" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="A" required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 text-sm text-center" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">出席番号</label>
                  <input type="text" value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} placeholder="12" required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 text-sm text-center" />
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-600 mb-1">氏名</label>
                <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="田中太郎" required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 text-sm" />
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <button type="submit" disabled={isSending}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-xl transition-colors">
                  {isSending ? '開始中...' : 'チャットを開始する'}
                </button>
                <button type="button" onClick={() => { setPageState('entry'); setError('') }}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-xl transition-colors">
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
  // ③ 復元コード表示画面
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
  // ④ アドバイス表示画面
  // ============================================================
  if (pageState === 'advice-shown' && adviceResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md sm:max-w-lg md:max-w-2xl">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-3">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-800">アドバイス</h2>
              <p className="text-gray-500 text-sm mt-0.5">以下があなたへのアドバイスです</p>
            </div>

            {/* アドバイス（マークダウン） */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-green-700 text-xs font-semibold">アドバイス</span>
              </div>
              <div className="text-green-800 text-sm leading-relaxed prose prose-sm prose-green">
                <ReactMarkdown>{adviceResult.advice}</ReactMarkdown>
              </div>
            </div>

            {/* ① コピーボタン */}
            <button
              onClick={handleCopyAdvice}
              className="w-full py-2.5 mb-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {copied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-3M8 6a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2v0z" />
                )}
              </svg>
              {copied ? 'コピー済み！' : 'アドバイスをコピーする'}
            </button>

            {/* 閉じるボタン → 警告モーダルを出す */}
            <button
              onClick={() => setShowCloseWarning(true)}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>

        {/* 閉じる確認モーダル */}
        {showCloseWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mb-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">このまま閉じますか？</h3>
                <p className="text-gray-500 text-sm mb-3">閉じてしまうと見えなくなります。以下の復元コードを使えば再度見ることはできますが、先にコピーしておくことをおすすめします。</p>
                <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">復元コード</p>
                  <p className="text-lg font-bold font-mono text-gray-800 tracking-widest">{session?.recovery_code}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowCloseWarning(false)
                    setPageState('entry')
                    setRecoveryInput('')
                    setError('')
                  }}
                  className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-colors"
                >
                  閉じる
                </button>
                <button
                  onClick={() => setShowCloseWarning(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-xl transition-colors"
                >
                  戻る
                </button>
              </div>
            </div>
          </div>
        )}
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
            <h1 className="text-sm font-bold text-gray-800">壁打ちくん</h1>
            <p className="text-xs text-gray-400">{session?.student_name} さん</p>
          </div>
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

          {/* ② 復元時・アドバイス済みの場合バナー */}
          {isCompleted && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-green-700 text-sm font-semibold">この会話は完了しています</span>
              </div>
              <button
                onClick={() => {
                  setAdviceResult({ summary: session!.summary || '', advice: session!.advice! })
                  setPageState('advice-shown')
                }}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                アドバイスを見る
              </button>
            </div>
          )}

          {messages.length === 0 && !isCompleted && (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">困っていること、悩んでいることを教えてください。（まとまっていなくてもOKです👍）</p>
            </div>
          )}

          {/* メッセージ一覧 */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                ${msg.role === 'user' ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-600'}`}
              >
                {msg.role === 'user' ? (session?.student_name.charAt(0) ?? '生') : 'AI'}
              </div>

              <div className={`max-w-[80%] rounded-2xl px-4 py-3
                ${msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' && msg.id === streamingMessageId && msg.content === '' ? (
                  <p className="text-sm text-gray-400">返信中...</p>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}

                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-right text-primary-200' : 'text-left text-gray-400'}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ボタン・入力エリア */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto">

          {/* アドバイス・保存退出ボタン（完了済みの場合は非表示） */}
          {!isCompleted && (
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
                className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-600 text-sm font-medium rounded-xl transition-colors"
              >
                {isSending ? '処理中...' : '保存して退出する'}
              </button>
            </div>
          )}

          {/* チャット入力フォーム（完了済みの場合は無効） */}
          <form onSubmit={handleChatSend} className="flex gap-2 items-end">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                  e.preventDefault()
                  handleChatSend(e)
                }
              }}
              placeholder={isCompleted ? 'この会話は完了しています' : 'メッセージを入力してください'}
              rows={2}
              disabled={isSending || remaining <= 0 || !!isCompleted}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none text-gray-800 placeholder-gray-400 text-base disabled:bg-gray-50 disabled:text-gray-400 resize-none"
            />
            <button
              type="submit"
              disabled={isSending || !chatInput.trim() || remaining <= 0 || !!isCompleted}
              className="px-5 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-xl transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4l-1.41 1.41L16.59 11H4v2h12.59l-6 6L12 20l8-8z" />
              </svg>
            </button>
          </form>

          {remaining <= 0 && !isCompleted && (
            <p className="text-center text-red-500 text-xs mt-2">
              会話の上限に達しました。アドバイスを頂くか、保存して退出してください。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
