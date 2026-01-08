"use client"

import { useState } from "react"
import { useDictionary } from "@/lib/hooks/useDictionary"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DictionaryCacheTestPage() {
  const [showDetails, setShowDetails] = useState(false)
  
  // 测试不同分类的字典数据
  const { items: subjects, loading: subjectsLoading } = useDictionary('subject')
  const { items: gradeLevels, loading: gradeLevelsLoading } = useDictionary('grade_level')
  const { items: cities, loading: citiesLoading } = useDictionary('city')

  const isLoading = subjectsLoading || gradeLevelsLoading || citiesLoading

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">字典缓存测试页面</h1>
      
      <div className="mb-4">
        <Button 
          onClick={() => setShowDetails(!showDetails)}
          variant="outline"
        >
          {showDetails ? '隐藏' : '显示'}详细信息
        </Button>
      </div>

      <div className="mb-4 p-4 bg-gray-100 rounded">
        <p className="text-sm">
          状态: {isLoading ? '加载中...' : '已加载'}
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

      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">缓存说明:</h3>
        <ul className="text-sm space-y-1">
          <li>• 首次加载时会从服务器获取数据</li>
          <li>• 数据会被缓存5分钟</li>
          <li>• 切换到其他页面再回来时，数据会立即显示（如果缓存未过期）</li>
          <li>• 修改字典数据时会自动清除缓存</li>
        </ul>
      </div>
    </div>
  )
}
