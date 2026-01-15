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
   * 获取用户列表（可按角色过滤）
   * @param role - 角色过滤，如 'operator', 'sales' 等，不传则获取所有用户
   */
  async getUsers(role?: string): Promise<UserProfile[]> {
    try {
      const url = role ? `/api/user-profiles?role=${role}` : '/api/user-profiles'
      const response = await api.get(url)
      if (!response.ok) {
        throw new Error('获取用户列表失败')
      }
      const { data } = await response.json()
      return data || []
    } catch (error: any) {
      console.error('获取用户失败:', error)
      throw error
    }
  },

  /**
   * 获取所有运营人员
   */
  async getAllOperators(): Promise<UserProfile[]> {
    return this.getUsers('operator')
  },

  /**
   * 获取所有用户
   */
  async getAllUserProfiles(): Promise<UserProfile[]> {
    return this.getUsers()
  }
}
