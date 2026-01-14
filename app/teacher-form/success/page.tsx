import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function TeacherFormSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 px-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">提交成功！</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-gray-600">
              感谢您填写详细信息！
            </p>
            <p className="text-gray-600">
              我们已经收到您的资料，教务老师会尽快与您联系。
            </p>
            <div className="pt-4 space-y-2">
              <p className="text-sm text-gray-500">
                如有疑问，请联系：
              </p>
              <p className="text-sm font-medium">
                小牛好学教务老师
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
