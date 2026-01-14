import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    // 1. 解析表单数据
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileType = formData.get('type') as string // 'photo' or 'screenshots'

    if (!file) {
      return NextResponse.json({ error: '没有上传文件' }, { status: 400 })
    }

    // 2. 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: '不支持的文件类型',
        allowedTypes
      }, { status: 400 })
    }

    // 3. 验证文件大小（最大 10MB）
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: '文件大小超过限制',
        maxSize: '10MB'
      }, { status: 400 })
    }

    // 4. 确定 bucket 名称
    const bucketName = 'teacher-form-files'

    // 5. 转换文件为 Buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${uuidv4()}-${file.name}`

    // 6. 确保 bucket 存在
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.id === bucketName)

    if (!bucketExists) {
      // 创建 bucket
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
      })
      if (createError && !createError.message.includes('already exists')) {
        console.error('Bucket creation error:', createError)
        return NextResponse.json({ error: '创建存储桶失败' }, { status: 500 })
      }
    }

    // 7. 上传到 Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('上传文件失败:', error)
      return NextResponse.json({
        error: '上传失败',
        details: error.message
      }, { status: 500 })
    }

    // 8. 获取公共URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(data.path)

    // 9. 返回结果
    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path
    }, { status: 201 })

  } catch (error) {
    console.error('上传文件时出错:', error)
    return NextResponse.json({
      error: '服务器错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}
