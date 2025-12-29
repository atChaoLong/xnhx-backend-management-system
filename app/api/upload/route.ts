import { NextRequest, NextResponse } from "next/server"
import { supabaseServer, supabaseAdmin } from "@/lib/supabase"
import { v4 as uuidv4 } from "uuid"
import { createLogger } from "@/lib/logger"

const logger = createLogger('API:Upload')

const ALLOWED_BUCKETS = [
  'teacher-photos',
  'teacher-resumes',
  'lead-resumes',
  'lead-attachments',
  'payment-proofs',
  'chat-screenshots',
]

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return false
    }

    const { data: { user } } = await supabaseServer.auth.getUser(token)
    return !!user
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authenticated = await isAuthenticated(request)
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucketName = (formData.get('bucket') as string) || 'chat-screenshots'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate bucket name
    if (!ALLOWED_BUCKETS.includes(bucketName)) {
      return NextResponse.json({ error: 'Invalid bucket name' }, { status: 400 })
    }

    logger.debug('Uploading file', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      bucket: bucketName
    })

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${uuidv4()}-${file.name}`

    // Ensure bucket exists (use admin client to bypass RLS)
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.id === bucketName)

    if (!bucketExists) {
      logger.info('Creating storage bucket', { bucketName })
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
      })
      if (createError && !createError.message.includes('already exists')) {
        logger.error('Bucket creation error', { bucketName, error: createError })
        return NextResponse.json({ error: 'Failed to create storage bucket' }, { status: 500 })
      }
    }

    // Upload to Supabase Storage
    // Use admin client to bypass RLS policies
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      logger.error('Upload error', { bucketName, fileName, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Get public URL
    // Use admin client to get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(data.path)

    logger.info('File uploaded successfully', {
      bucketName,
      path: data.path,
      url: urlData.publicUrl
    })

    return NextResponse.json({ url: urlData.publicUrl, path: data.path })
  } catch (error: any) {
    logger.error('Upload exception', { message: error.message, stack: error.stack })
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}
