import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 处理数据库错误，返回用户友好的错误消息和HTTP状态码
 * @param error 数据库错误对象
 * @returns { message: string, status: number } 错误消息和HTTP状态码
 */
export function handleDatabaseError(error: any): { message: string; status: number } {
  const errorCode = error?.code
  const errorMessage = error?.message || ''

  // 唯一约束冲突 (PostgreSQL error code 23505)
  if (errorCode === '23505' || errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
    // 提取约束名称
    const constraintMatch = errorMessage.match(/unique constraint "([^"]+)"/)
    const constraintName = constraintMatch ? constraintMatch[1] : ''

    // 通用唯一约束错误
    return {
      message: '数据已存在，请勿重复添加',
      status: 409
    }
  }

  // 外键约束冲突 (PostgreSQL error code 23503)
  if (errorCode === '23503' || errorMessage.includes('foreign key') || errorMessage.includes('violates foreign key')) {
    return {
      message: '该数据已被其他记录关联，无法删除',
      status: 400
    }
  }

  // 非空约束冲突 (PostgreSQL error code 23502)
  if (errorCode === '23502' || errorMessage.includes('not-null') || errorMessage.includes('null value in column')) {
    return {
      message: '必填字段不能为空',
      status: 400
    }
  }

  // 检查约束冲突 (PostgreSQL error code 23514)
  if (errorCode === '23514' || errorMessage.includes('check constraint')) {
    return {
      message: '数据格式或值不符合要求',
      status: 400
    }
  }

  // 默认错误
  return {
    message: errorMessage || '操作失败，请稍后重试',
    status: 500
  }
}
