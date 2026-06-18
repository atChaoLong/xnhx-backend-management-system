export type TodoSlaStatus = 'normal' | 'due_today' | 'overdue' | 'completed' | 'cancelled' | 'no_due_date'
export type TodoEscalationLevel = 'none' | 'watch' | 'urgent' | 'critical'

export interface TodoSlaFields {
  sla_status: TodoSlaStatus
  sla_status_name: string
  is_overdue: boolean
  days_overdue: number
  escalation_level: TodoEscalationLevel
  escalation_level_name: string
  escalation_reason: string | null
}

const SLA_STATUS_NAMES: Record<TodoSlaStatus, string> = {
  normal: '正常',
  due_today: '今日到期',
  overdue: '已逾期',
  completed: '已完成',
  cancelled: '已取消',
  no_due_date: '无截止时间',
}

const ESCALATION_LEVEL_NAMES: Record<TodoEscalationLevel, string> = {
  none: '无需升级',
  watch: '需关注',
  urgent: '需升级',
  critical: '严重升级',
}

function startOfLocalDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfLocalDay(date: Date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function daysUntilDue(dueDate: Date, now: Date) {
  return Math.ceil((startOfLocalDay(dueDate).getTime() - startOfLocalDay(now).getTime()) / 86_400_000)
}

function getTodoEscalation(
  todo: { status?: string | null; due_date?: string | null; priority?: string | null },
  sla: Pick<TodoSlaFields, 'sla_status' | 'days_overdue'>,
  now = new Date()
): Pick<TodoSlaFields, 'escalation_level' | 'escalation_level_name' | 'escalation_reason'> {
  if (todo.status !== 'pending') {
    return {
      escalation_level: 'none',
      escalation_level_name: ESCALATION_LEVEL_NAMES.none,
      escalation_reason: null,
    }
  }

  const priority = todo.priority || 'medium'

  if (sla.sla_status === 'overdue') {
    if (sla.days_overdue >= 3 || (sla.days_overdue >= 1 && (priority === 'urgent' || priority === 'high'))) {
      return {
        escalation_level: 'critical',
        escalation_level_name: ESCALATION_LEVEL_NAMES.critical,
        escalation_reason: priority === 'urgent' || priority === 'high'
          ? `高优先级待办已逾期${sla.days_overdue}天`
          : `待办已逾期${sla.days_overdue}天`,
      }
    }

    return {
      escalation_level: 'urgent',
      escalation_level_name: ESCALATION_LEVEL_NAMES.urgent,
      escalation_reason: `待办已逾期${sla.days_overdue}天`,
    }
  }

  if (!todo.due_date) {
    return {
      escalation_level: 'none',
      escalation_level_name: ESCALATION_LEVEL_NAMES.none,
      escalation_reason: null,
    }
  }

  const dueDate = new Date(todo.due_date)
  if (Number.isNaN(dueDate.getTime())) {
    return {
      escalation_level: 'none',
      escalation_level_name: ESCALATION_LEVEL_NAMES.none,
      escalation_reason: null,
    }
  }

  const daysUntil = daysUntilDue(dueDate, now)
  if (daysUntil <= 0 && (priority === 'urgent' || priority === 'high')) {
    return {
      escalation_level: 'watch',
      escalation_level_name: ESCALATION_LEVEL_NAMES.watch,
      escalation_reason: '高优先级待办今日到期',
    }
  }

  if (daysUntil === 1 && priority === 'urgent') {
    return {
      escalation_level: 'watch',
      escalation_level_name: ESCALATION_LEVEL_NAMES.watch,
      escalation_reason: '紧急待办明日到期',
    }
  }

  return {
    escalation_level: 'none',
    escalation_level_name: ESCALATION_LEVEL_NAMES.none,
    escalation_reason: null,
  }
}

export function calculateTodoSla(
  todo: { status?: string | null; due_date?: string | null; priority?: string | null },
  now = new Date()
): TodoSlaFields {
  let sla: Omit<TodoSlaFields, 'escalation_level' | 'escalation_level_name' | 'escalation_reason'>

  if (todo.status === 'completed') {
    sla = {
      sla_status: 'completed',
      sla_status_name: SLA_STATUS_NAMES.completed,
      is_overdue: false,
      days_overdue: 0,
    }
  } else if (todo.status === 'cancelled') {
    sla = {
      sla_status: 'cancelled',
      sla_status_name: SLA_STATUS_NAMES.cancelled,
      is_overdue: false,
      days_overdue: 0,
    }
  } else if (!todo.due_date) {
    sla = {
      sla_status: 'no_due_date',
      sla_status_name: SLA_STATUS_NAMES.no_due_date,
      is_overdue: false,
      days_overdue: 0,
    }
  } else {
    const dueDate = new Date(todo.due_date)
    if (Number.isNaN(dueDate.getTime())) {
      sla = {
        sla_status: 'no_due_date',
        sla_status_name: SLA_STATUS_NAMES.no_due_date,
        is_overdue: false,
        days_overdue: 0,
      }
    } else {
      const todayStart = startOfLocalDay(now)
      const todayEnd = endOfLocalDay(now)

      if (dueDate < todayStart) {
        const overdueDays = Math.max(
          1,
          Math.ceil((todayStart.getTime() - startOfLocalDay(dueDate).getTime()) / 86_400_000)
        )

        sla = {
          sla_status: 'overdue',
          sla_status_name: SLA_STATUS_NAMES.overdue,
          is_overdue: true,
          days_overdue: overdueDays,
        }
      } else if (dueDate <= todayEnd) {
        sla = {
          sla_status: 'due_today',
          sla_status_name: SLA_STATUS_NAMES.due_today,
          is_overdue: false,
          days_overdue: 0,
        }
      } else {
        sla = {
          sla_status: 'normal',
          sla_status_name: SLA_STATUS_NAMES.normal,
          is_overdue: false,
          days_overdue: 0,
        }
      }
    }
  }

  return {
    ...sla,
    ...getTodoEscalation(todo, sla, now),
  }
}

export function attachTodoSla<T extends { status?: string | null; due_date?: string | null; priority?: string | null }>(todo: T, now = new Date()) {
  return {
    ...todo,
    ...calculateTodoSla(todo, now),
  }
}

export function startAndEndOfToday(now = new Date()) {
  return {
    todayStart: startOfLocalDay(now),
    todayEnd: endOfLocalDay(now),
  }
}
