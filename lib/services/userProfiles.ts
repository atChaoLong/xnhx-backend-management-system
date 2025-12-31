/**
 * 用户档案服务
 */
import { api } from '@/lib/fetch'

export interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  avatar_url?: string
  created_at: string
}

export const UserProfilesService = {
  /**
   * 获取所有运营人员（user_profiles）
   */
  async getAllOperators(): Promise<UserProfile[]> {
    try {
      const response = await api.get('/api/user-profiles')
      if (!response.ok) {
        throw new Error('获取运营人员列表失败')
      }
      const { data } = await response.json()
      return data || []
    } catch (error: any) {
      console.error('获取运营人员失败:', error)
      throw error
    }
  }
}
