import type { CurrentProfile } from '@/lib/server-data-scope'

type LeadAccessLike = {
  grab_user_id?: string | null
  grab_wechat?: string | null
  created_by?: string | null
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function postgrestTextEqualsFilter(column: string, value: unknown): string {
  const normalized = normalizeText(value)
  if (!normalized) return ''
  return `${column}.eq.${quotePostgrestValue(normalized)}`
}

export function leadGrabWechatEqualsProfileFilter(profile: CurrentProfile | null): string {
  return postgrestTextEqualsFilter('grab_wechat', profile?.name)
}

export function leadCreatedByEqualsProfileFilter(profile: CurrentProfile | null): string {
  return postgrestTextEqualsFilter('created_by', profile?.name)
}

export function isUnassignedLead(lead: LeadAccessLike): boolean {
  return !lead.grab_user_id && !normalizeText(lead.grab_wechat)
}

export function isLeadAssignedToProfile(lead: LeadAccessLike, profile: CurrentProfile | null): boolean {
  if (!profile) return false
  if (lead.grab_user_id && lead.grab_user_id === profile.id) return true

  const assigneeName = normalizeText(lead.grab_wechat)
  const profileName = normalizeText(profile.name)
  return Boolean(assigneeName && profileName && assigneeName === profileName)
}

export function isLeadCreatedByProfile(lead: LeadAccessLike, profile: CurrentProfile | null): boolean {
  const createdBy = normalizeText(lead.created_by)
  const profileName = normalizeText(profile?.name)
  return Boolean(createdBy && profileName && createdBy === profileName)
}
