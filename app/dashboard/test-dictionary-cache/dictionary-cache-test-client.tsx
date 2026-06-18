"use client"

import { useState } from "react"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { usePermission } from "@/lib/hooks/usePermission"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function DictionaryCacheTestContent() {
  const [showDetails, setShowDetails] = useState(false)
  const { items: subjects, loading: subjectsLoading } = useDictionary("subject")
  const { items: gradeLevels, loading: gradeLevelsLoading } = useDictionary("grade_level")
  const { items: cities, loading: citiesLoading } = useDictionary("city")

  const isLoading = subjectsLoading || gradeLevelsLoading || citiesLoading

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">字典缓存测试页面</h1>

      <div className="mb-4">
        <Button
          onClick={() => setShowDetails(!showDetails)}
          variant="outline"
        >
          {showDetails ? "隐藏" : "显示"}详细信息
        </Button>
      </div>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p className="text-sm">
          状态: {isLoading ? "加载中..." : "已加载"}
        </p>
        <p className="text-sm">
          学科数量: {subjects.length}
        </p>
        <p className="text-sm">
          年级数量: {gradeLevels.length}
        </p>
        <p className="text-sm">
          城市数量: {cities.length}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>学科</CardTitle>
          </CardHeader>
          <CardContent>
            {showDetails && (
              <div className="space-y-2">
                {subjects.map(item => (
                  <div key={item.code} className="text-sm">
                    {item.code}: {item.label}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>年级</CardTitle>
          </CardHeader>
          <CardContent>
            {showDetails && (
              <div className="space-y-2">
                {gradeLevels.map(item => (
                  <div key={item.code} className="text-sm">
                    {item.code}: {item.label}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>城市</CardTitle>
          </CardHeader>
          <CardContent>
            {showDetails && (
              <div className="space-y-2">
                {cities.map(item => (
                  <div key={item.code} className="text-sm">
                    {item.code}: {item.label}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function DictionaryCacheTestClient() {
  const { role, isLoading } = usePermission()

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-sm text-muted-foreground">
        正在加载权限...
      </div>
    )
  }

  if (role !== "admin") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">无权访问</h1>
        <div className="p-4 bg-gray-100 rounded text-sm text-muted-foreground">
          字典缓存测试页面仅限管理员在调试环境中使用。
        </div>
      </div>
    )
  }

  return <DictionaryCacheTestContent />
}
