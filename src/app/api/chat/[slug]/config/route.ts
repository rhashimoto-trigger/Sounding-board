import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * GET /api/chat/[slug]/config
 * エントリ画面でタイトルを表示するために config を取得
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { data: config } = await supabase
    .from('chat_configs')
    .select('title, allow_student_privacy_toggle')
    .eq('slug', params.slug)
    .single() as { data: { title: string; allow_student_privacy_toggle: boolean } | null }

  if (!config) {
    return NextResponse.json({ error: 'URLが見つかりません' }, { status: 404 })
  }

  return NextResponse.json({ config })
}
