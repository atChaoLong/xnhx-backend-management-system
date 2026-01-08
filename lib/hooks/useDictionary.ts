/**
 * Simple dictionary cache hook
 * 基于现有字典服务的简单全局缓存
 */

import { useState, useEffect } from 'react'
import { getDictionaryItems, getAllDictionaries, DictionaryItem, DictionaryGroup } from '@/lib/services/dictionary'

// 全局缓存状态
interface GlobalCache {
  data: DictionaryGroup | null
  loading: boolean
  lastLoad: number
  subscribers: Set<(data: DictionaryGroup | null) => void>
}

const globalCache: GlobalCache = {
  data: null,
  loading: false,
  lastLoad: 0,
  subscribers: new Set()
}

const CACHE_DURATION = 5 * 60 * 1000 // 5分钟

/**
 * 检查缓存是否有效
 */
function isCacheValid(): boolean {
  return globalCache.data !== null && 
         Date.now() - globalCache.lastLoad < CACHE_DURATION
}

/**
 * 通知所有订阅者
 */
function notifySubscribers() {
  globalCache.subscribers.forEach(callback => callback(globalCache.data))
}

/**
 * 加载所有字典数据
 */
async function loadAllDictionaries(): Promise<DictionaryGroup> {
  if (isCacheValid()) {
    return globalCache.data!
  }

  if (globalCache.loading) {
    // 等待加载完成
    return new Promise((resolve) => {
      const checkLoading = () => {
        if (!globalCache.loading) {
          resolve(globalCache.data || {})
        } else {
          setTimeout(checkLoading, 50)
        }
      }
      checkLoading()
    })
  }

  globalCache.loading = true
  notifySubscribers()

  try {
    const data = await getAllDictionaries()
    globalCache.data = data
    globalCache.lastLoad = Date.now()
    globalCache.loading = false
    notifySubscribers()
    return data
  } catch (error) {
    globalCache.loading = false
    notifySubscribers()
    throw error
  }
}

/**
 * 获取单个分类的字典数据（带缓存）
 */
export function useDictionary(category: string) {
  const [items, setItems] = useState<DictionaryItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 订阅全局缓存变化
    const updateItems = (data: DictionaryGroup | null) => {
      setItems(data?.[category] || [])
      setLoading(globalCache.loading)
    }

    globalCache.subscribers.add(updateItems)
    updateItems(globalCache.data)

    // 如果没有有效缓存，开始加载
    if (!isCacheValid() && !globalCache.loading) {
      loadAllDictionaries()
    }

    return () => {
      globalCache.subscribers.delete(updateItems)
    }
  }, [category])

  return { items, loading }
}

/**
 * 获取所有字典数据（带缓存）
 */
export function useAllDictionaries() {
  const [data, setData] = useState<DictionaryGroup>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const updateData = (newData: DictionaryGroup | null) => {
      setData(newData || {})
      setLoading(globalCache.loading)
    }

    globalCache.subscribers.add(updateData)
    updateData(globalCache.data)

    if (!isCacheValid() && !globalCache.loading) {
      loadAllDictionaries()
    }

    return () => {
      globalCache.subscribers.delete(updateData)
    }
  }, [])

  return { data, loading }
}

/**
 * 手动刷新缓存
 */
export async function refreshDictionaryCache(): Promise<void> {
  globalCache.data = null
  globalCache.lastLoad = 0
  await loadAllDictionaries()
}
