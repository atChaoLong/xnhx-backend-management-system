interface CachedProfile {
  id: string
  name: string | null
  role: string
  is_active?: boolean | null
  email?: string | null
  created_at?: string | null
  fetchedAt: number
}

const CACHE_TTL_MS = 60 * 1000
const cache = new Map<string, CachedProfile>()

export function getCachedProfile(userId: string): CachedProfile | null {
  const entry = cache.get(userId)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(userId)
    return null
  }
  return entry
}

export function setCachedProfile(userId: string, profile: Omit<CachedProfile, 'fetchedAt'>): void {
  cache.set(userId, { ...profile, fetchedAt: Date.now() })
}

export function invalidateProfileCache(userId: string): void {
  cache.delete(userId)
}
