import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  const SID = process.env.CLASSIN_SID
  const SECRET = process.env.CLASSIN_SECRET
  const BASE_URL = process.env.CLASSIN_API_URL || 'api.eeo.cn'

  const now = Math.floor(Date.now() / 1000)

  return NextResponse.json({
    success: true,
    data: {
      hasSID: Boolean(SID),
      hasSECRET: Boolean(SECRET),
      baseURL: BASE_URL,
      serverEpochSeconds: now,
      notes: [
        '确保 CLASSIN_SID 为机构 UID（不是学校 UID 或用户 UID）',
        '确保 CLASSIN_SECRET 为 API v2 密钥（不是 safeKey）',
        'BASE_URL 使用 api.eeo.cn（v2），动态页面使用 dynamic.eeo.cn（web）',
        '若 hasSID 或 hasSECRET 为 false，请在 .env.local 中配置并重启服务',
      ],
    }
  })
}

