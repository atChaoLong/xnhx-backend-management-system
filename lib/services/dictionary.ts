/**
 * 字典服务层
 * 提供字典数据的统一管理和缓存
 */

import { api } from '@/lib/fetch'
import { summarizeError } from '@/lib/safe-error'

export interface DictionaryItem {
  id: string
  created_at: string
  updated_at: string
  category: string
  code: string
  label: string
  sort_order: number
  is_active: boolean
}

export interface NewDictionaryItem {
  category: string
  code: string
  label: string
  sort_order?: number
  is_active?: boolean
}

export interface DictionaryGroup {
  [key: string]: DictionaryItem[]
}

// 缓存配置
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟
let cache: DictionaryGroup | null = null
let cacheTime: number = 0
let teacherFormCache: DictionaryGroup | null = null
let teacherFormCacheTime: number = 0

function groupDictionaryItems(items: DictionaryItem[]): DictionaryGroup {
  const grouped: DictionaryGroup = {}

  items.forEach((item) => {
    if (!grouped[item.category]) {
      grouped[item.category] = []
    }
    grouped[item.category].push(item)
  })

  return grouped
}

/**
 * 清除字典缓存
 */
export function clearDictionaryCache(): void {
  cache = null
  cacheTime = 0
  teacherFormCache = null
  teacherFormCacheTime = 0
}

/**
 * 获取指定分类的字典项
 */
export async function getDictionaryItems(category: string): Promise<DictionaryItem[]> {
  // 检查缓存
  if (cache && Date.now() - cacheTime < CACHE_DURATION) {
    return cache[category] || []
  }

  try {
    const response = await api.get('/api/dictionaries?category=' + encodeURIComponent(category))

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取字典失败' }))
      throw new Error(error.error || '获取字典失败')
    }

    const { data } = await response.json()
    return data as DictionaryItem[]
  } catch (error: unknown) {
    console.error('Failed to fetch dictionary items:', {
      category,
      error: summarizeError(error),
    })
    return []
  }
}

/**
 * 获取所有字典项并按分类分组
 */
export async function getAllDictionaries(): Promise<DictionaryGroup> {
  // 检查缓存
  if (cache && Date.now() - cacheTime < CACHE_DURATION) {
    return cache
  }

  try {
    const response = await api.get('/api/dictionaries')

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取字典失败' }))
      throw new Error(error.error || '获取字典失败')
    }

    const { data } = await response.json()
    const items = data as DictionaryItem[]

    const grouped = groupDictionaryItems(items)

    // 更新缓存
    cache = grouped
    cacheTime = Date.now()

    return grouped
  } catch (error: unknown) {
    console.error('Failed to fetch all dictionaries:', summarizeError(error))
    // 返回缓存的旧数据（降级）
    return cache || {}
  }
}

/**
 * 获取老师外部表单需要的公开字典项
 */
export async function getTeacherFormDictionaries(): Promise<DictionaryGroup> {
  if (teacherFormCache && Date.now() - teacherFormCacheTime < CACHE_DURATION) {
    return teacherFormCache
  }

  try {
    const response = await api.get('/api/teacher-form/dictionaries')

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '获取老师表单字典失败' }))
      throw new Error(error.error || '获取老师表单字典失败')
    }

    const { data } = await response.json()
    const grouped = groupDictionaryItems(data as DictionaryItem[])

    teacherFormCache = grouped
    teacherFormCacheTime = Date.now()

    return grouped
  } catch (error: unknown) {
    console.error('Failed to fetch teacher form dictionaries:', summarizeError(error))
    return teacherFormCache || {}
  }
}

/**
 * 创建新字典项
 */
export async function createDictionary(item: NewDictionaryItem): Promise<DictionaryItem> {
  const response = await api.post('/api/dictionaries', item)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '创建字典失败' }))
    throw new Error(error.error || '创建字典失败')
  }

  // 清除缓存
  clearDictionaryCache()

  const { data } = await response.json()
  return data as DictionaryItem
}

/**
 * 更新字典项
 */
export async function updateDictionary(id: string, item: Partial<NewDictionaryItem>): Promise<DictionaryItem> {
  const response = await api.put('/api/dictionaries', { ...item, id })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '更新字典失败' }))
    throw new Error(error.error || '更新字典失败')
  }

  // 清除缓存
  clearDictionaryCache()

  const { data } = await response.json()
  return data as DictionaryItem
}

/**
 * 根据ID获取单个字典项
 */
export async function getDictionaryById(id: string): Promise<DictionaryItem> {
  const response = await api.get(`/api/dictionaries?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '获取字典失败' }))
    throw new Error(error.error || '获取字典失败')
  }

  const { data } = await response.json()
  return data as DictionaryItem
}

/**
 * 删除字典项（软删除）
 */
export async function deleteDictionary(id: string): Promise<boolean> {
  const response = await api.delete(`/api/dictionaries?id=${encodeURIComponent(id)}`)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除字典失败' }))
    throw new Error(error.error || '删除字典失败')
  }

  // 清除缓存
  clearDictionaryCache()

  return true
}

/**
 * 字典服务对象
 */
export const DictionaryService = {
  getDictionaryItems,
  getAllDictionaries,
  getTeacherFormDictionaries,
  getDictionaryById,
  createDictionary,
  updateDictionary,
  deleteDictionary,
  clearCache: clearDictionaryCache,
}
