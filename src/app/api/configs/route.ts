import { NextResponse, NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { supabase } from '@/lib/supabase'
import { generateSlug } from '@/lib/utils'

/**
 * POST /api/configs
 * URL設定を新規作成する
 */
export async function POST(req: NextRequest) {
  // 認証チェック
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })
  if (!token?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // リクエストボディの取得
  const { title, theme, approach, important_points, source_text, allow_student_privacy_toggle } = await req.json()

  // バリデーション
  if (!title || !theme || !approach || !important_points) {
    return NextResponse.json({ error: 'タイトル・テーマ・アプローチ・重視すべき点は必須です' }, { status: 400 })
  }

  // slug の重複チェックつきで生成
  let slug = generateSlug()
  let attempts = 0
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from('chat_configs')
      .select('id')
      .eq('slug', slug)
      .single() as { data: { id: string } | null }

    if (!existing) break // 重複なし
    slug = generateSlug()
    attempts++
  }

  if (attempts >= 10) {
    return NextResponse.json({ error: 'URL生成に失敗しました。もう一度お試しください' }, { status: 500 })
  }

  // Supabaseに保存
  const insertQuery = supabase
    .from('chat_configs')
    .insert({
      teacher_id: token.id as string,
      slug,
      title: title.trim(),
      theme,
      approach,
      important_points,
      source_text: source_text || null,
      allow_student_privacy_toggle: allow_student_privacy_toggle || false,
    })
    .select()

  const { data, error } = (await insertQuery) as { data: any[]; error: any }

  if (error) {
    return NextResponse.json({ error: 'データの保存に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ config: data[0] }, { status: 201 })
}

/**
 * GET /api/configs
 * ログイン先生のURL一覧を取得する
 */
export async function GET(req: NextRequest) {
  // 認証チェック
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })
  if (!token?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('chat_configs')
    .select('*')
    .eq('teacher_id', token.id as string)
    .order('created_at', { ascending: false }) as { data: any[]; error: any }

  if (error) {
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ configs: data })
}
