/**
 * 初期先生アカウント作成スクリプト
 * 
 * 使い方：
 *   1. .env.local に SUPABASE_URL と SUPABASE_ANON_KEY を設定した状態で
 *   2. 下記コマンドで実行：
 *        node scripts/create-teacher.mjs
 * 
 * 実行後、Supabaseの管理画面 > teachers テーブルに確認してください。
 */

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// .env.local を読み込む
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '..', '.env.local')

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim()
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません')
  console.error('   .env.local に設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ===== ここで先生のメールアドレス・パスワードを入れてください =====
const TEACHER_EMAIL = 'teacher@school.jp'
const TEACHER_PASSWORD = 'changeme123'
// ================================================================

async function main() {
  console.log('👤 先生アカウントを作成しています...')
  console.log(`   メールアドレス: ${TEACHER_EMAIL}`)

  // パスワードハッシュ化
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(TEACHER_PASSWORD, salt)

  // 既存チェック
  const { data: existing } = await supabase
    .from('teachers')
    .select('id, email')
    .eq('email', TEACHER_EMAIL)
    .single()

  if (existing) {
    console.log('⚠️  このメールアドレスのアカウントは既に存在します')
    console.log(`   ID: ${existing.id}`)
    process.exit(0)
  }

  // 作成
  const { data, error } = await supabase
    .from('teachers')
    .insert({
      email: TEACHER_EMAIL,
      password: hashedPassword,
    })
    .select()

  if (error) {
    console.error('❌ アカウント作成に失敗しました:', error.message)
    process.exit(1)
  }

  console.log('✅ アカウント作成完了!')
  console.log(`   ID: ${data[0].id}`)
  console.log(`   メールアドレス: ${data[0].email}`)
  console.log('')
  console.log('ログイン情報:')
  console.log(`   メールアドレス: ${TEACHER_EMAIL}`)
  console.log(`   パスワード: ${TEACHER_PASSWORD}`)
}

main()
