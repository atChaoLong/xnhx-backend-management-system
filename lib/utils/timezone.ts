/**
 * 时区处理工具
 * 统一处理中国时区 (UTC+8) 的时间转换
 */
import { summarizeError } from '@/lib/safe-error'

/**
 * 中国时区偏移量（UTC+8）
 */
export const CHINA_TIMEZONE_OFFSET = '+08:00'

/**
 * 将 datetime-local 格式转换为带时区的 ISO 8601 字符串
 * @param localTime - 本地时间字符串，格式如 "2026-01-22T14:00"
 * @returns 带中国时区的 ISO 8601 字符串，如 "2026-01-22T14:00:00+08:00"
 */
export function toChinaTimeISO(localTime: string): string {
  if (!localTime) return ''

  // 如果已经包含时区信息，直接返回
  if (localTime.includes('+') || localTime.includes('Z')) {
    return localTime
  }

  // 添加秒数和中国时区
  const timeWithSeconds = localTime.includes(':')
    ? localTime + ':00'
    : localTime + 'T00:00:00'

  return timeWithSeconds + CHINA_TIMEZONE_OFFSET
}

/**
 * 从 ISO 8601 字符串提取 datetime-local 格式
 * @param isoTime - ISO 8601 字符串，如 "2026-01-22T14:00:00+08:00"
 * @returns datetime-local 格式，如 "2026-01-22T14:00"
 */
export function fromISOToDatetimeLocal(isoTime: string): string {
  if (!isoTime) return ''

  try {
    const date = new Date(isoTime)
    if (isNaN(date.getTime())) return ''

    // 格式化为 YYYY-MM-DDTHH:mm
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch (error) {
    console.error('转换时间失败:', summarizeError(error))
    return ''
  }
}

/**
 * 确保时间字符串带有时区信息
 * @param time - 时间字符串
 * @returns 带中国时区的 ISO 8601 字符串
 */
export function ensureChinaTimezone(time: string): string {
  if (!time) return ''
  return toChinaTimeISO(time)
}

/**
 * 创建中国时区的 Date 对象
 * @param isoTime - ISO 8601 字符串（带或不带时区）
 * @returns Date 对象
 */
export function createChinaDate(isoTime: string): Date {
  const timeWithTimezone = ensureChinaTimezone(isoTime)
  return new Date(timeWithTimezone)
}
