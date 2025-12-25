"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { Toaster } from "@/hooks/use-toast"
import type {
  User,
  Lead,
  TeacherCandidate,
  Student,
  Teacher,
  TrialLesson,
  FormalOrder,
  DailyLead,
  WechatAccount,
  SalesPersonnel,
  TransactionRecord,
  SysDictionary,
  Activity
} from "./types"

interface AppContextType {
  // Auth
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void

  // Leads
  leads: Lead[]
  addLead: (lead: Omit<Lead, "id" | "createdAt" | "updatedAt">) => void
  updateLead: (id: string, lead: Partial<Lead>) => void
  deleteLead: (id: string) => void

  // Teacher Candidates
  teacherCandidates: TeacherCandidate[]
  addTeacherCandidate: (candidate: Omit<TeacherCandidate, "id" | "createdAt" | "updatedAt">) => void
  updateTeacherCandidate: (id: string, candidate: Partial<TeacherCandidate>) => void
  deleteTeacherCandidate: (id: string) => void

  // Students
  students: Student[]
  addStudent: (student: Omit<Student, "id" | "createdAt" | "updatedAt">) => void
  updateStudent: (id: string, student: Partial<Student>) => void
  deleteStudent: (id: string) => void

  // Teachers
  teachers: Teacher[]
  addTeacher: (teacher: Omit<Teacher, "id" | "createdAt" | "updatedAt">) => void
  updateTeacher: (id: string, teacher: Partial<Teacher>) => void
  deleteTeacher: (id: string) => void

  // Trial Lessons
  trialLessons: TrialLesson[]
  addTrialLesson: (lesson: Omit<TrialLesson, "id" | "createdAt" | "updatedAt">) => void
  updateTrialLesson: (id: string, lesson: Partial<TrialLesson>) => void
  deleteTrialLesson: (id: string) => void

  // Formal Orders
  formalOrders: FormalOrder[]
  addFormalOrder: (order: Omit<FormalOrder, "id" | "orderNumber" | "createdAt" | "updatedAt">) => void
  updateFormalOrder: (id: string, order: Partial<FormalOrder>) => void
  deleteFormalOrder: (id: string) => void

  // Daily Leads
  dailyLeads: DailyLead[]
  addDailyLead: (dailyLead: Omit<DailyLead, "id" | "createdAt" | "updatedAt">) => void
  updateDailyLead: (id: string, dailyLead: Partial<DailyLead>) => void
  deleteDailyLead: (id: string) => void

  // Wechat Accounts
  wechatAccounts: WechatAccount[]
  addWechatAccount: (account: Omit<WechatAccount, "id" | "createdAt" | "updatedAt">) => void
  updateWechatAccount: (id: string, account: Partial<WechatAccount>) => void
  deleteWechatAccount: (id: string) => void

  // Sales Personnel
  salesPersonnel: SalesPersonnel[]
  addSalesPersonnel: (personnel: Omit<SalesPersonnel, "id" | "createdAt" | "updatedAt">) => void
  updateSalesPersonnel: (id: string, personnel: Partial<SalesPersonnel>) => void
  deleteSalesPersonnel: (id: string) => void

  // Transaction Records
  transactionRecords: TransactionRecord[]
  addTransactionRecord: (record: Omit<TransactionRecord, "id" | "createdAt">) => void
  updateTransactionRecord: (id: string, record: Partial<TransactionRecord>) => void
  deleteTransactionRecord: (id: string) => void

  // System Dictionaries
  sysDictionaries: SysDictionary[]
  addSysDictionary: (dict: Omit<SysDictionary, "id" | "createdAt" | "updatedAt">) => void
  updateSysDictionary: (id: string, dict: Partial<SysDictionary>) => void
  deleteSysDictionary: (id: string) => void

  // Activities
  activities: Activity[]
  addActivity: (activity: Omit<Activity, "id" | "createdAt">) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [teacherCandidates, setTeacherCandidates] = useState<TeacherCandidate[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [trialLessons, setTrialLessons] = useState<TrialLesson[]>([])
  const [formalOrders, setFormalOrders] = useState<FormalOrder[]>([])
  const [dailyLeads, setDailyLeads] = useState<DailyLead[]>([])
  const [wechatAccounts, setWechatAccounts] = useState<WechatAccount[]>([])
  const [salesPersonnel, setSalesPersonnel] = useState<SalesPersonnel[]>([])
  const [transactionRecords, setTransactionRecords] = useState<TransactionRecord[]>([])
  const [sysDictionaries, setSysDictionaries] = useState<SysDictionary[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

  // Auth functions
  const login = useCallback(async (email: string, password: string) => {
    // 模拟登录验证
    if (email && password.length >= 6) {
      setUser({
        id: "1",
        email,
        name: email.split("@")[0],
        role: "admin",
        createdAt: new Date().toISOString().split("T")[0],
      })
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  // Lead functions
  const addLead = useCallback(
    (lead: Omit<Lead, "id" | "createdAt" | "updatedAt">) => {
      const newLead: Lead = {
        ...lead,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setLeads((prev) => [newLead, ...prev])
      addActivity({
        type: "note",
        description: `新增线索：${lead.orderSerial}`,
        createdBy: user?.name || "系统",
      })
    },
    [user],
  )

  const updateLead = useCallback((id: string, updates: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l)))
  }, [])

  const deleteLead = useCallback((id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id))
  }, [])

  // Teacher Candidate functions
  const addTeacherCandidate = useCallback(
    (candidate: Omit<TeacherCandidate, "id" | "createdAt" | "updatedAt">) => {
      const newCandidate: TeacherCandidate = {
        ...candidate,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTeacherCandidates((prev) => [newCandidate, ...prev])
      addActivity({
        type: "note",
        description: `新增老师面试：${candidate.name}`,
        createdBy: user?.name || "系统",
      })
    },
    [user],
  )

  const updateTeacherCandidate = useCallback((id: string, updates: Partial<TeacherCandidate>) => {
    setTeacherCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c))
    )
  }, [])

  const deleteTeacherCandidate = useCallback((id: string) => {
    setTeacherCandidates((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // Student functions
  const addStudent = useCallback(
    (student: Omit<Student, "id" | "createdAt" | "updatedAt">) => {
      const newStudent: Student = {
        ...student,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setStudents((prev) => [newStudent, ...prev])
      addActivity({
        type: "note",
        description: `新增学生：${student.name}`,
        createdBy: user?.name || "系统",
      })
    },
    [user],
  )

  const updateStudent = useCallback((id: string, updates: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s)))
  }, [])

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id))
  }, [])

  // Teacher functions
  const addTeacher = useCallback(
    (teacher: Omit<Teacher, "id" | "createdAt" | "updatedAt">) => {
      const newTeacher: Teacher = {
        ...teacher,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTeachers((prev) => [newTeacher, ...prev])
      addActivity({
        type: "note",
        description: `新增老师：${teacher.name}`,
        createdBy: user?.name || "系统",
      })
    },
    [user],
  )

  const updateTeacher = useCallback((id: string, updates: Partial<Teacher>) => {
    setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t)))
  }, [])

  const deleteTeacher = useCallback((id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Trial Lesson functions
  const addTrialLesson = useCallback(
    (lesson: Omit<TrialLesson, "id" | "createdAt" | "updatedAt">) => {
      const newLesson: TrialLesson = {
        ...lesson,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTrialLessons((prev) => [newLesson, ...prev])
      addActivity({
        type: "note",
        description: `新增试听课程：${lesson.childName}`,
        createdBy: user?.name || "系统",
      })
    },
    [user],
  )

  const updateTrialLesson = useCallback((id: string, updates: Partial<TrialLesson>) => {
    setTrialLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l))
    )
  }, [])

  const deleteTrialLesson = useCallback((id: string) => {
    setTrialLessons((prev) => prev.filter((l) => l.id !== id))
  }, [])

  // Formal Order functions
  const addFormalOrder = useCallback(
    (order: Omit<FormalOrder, "id" | "orderNumber" | "createdAt" | "updatedAt">) => {
      // 生成订单号
      const student = students.find((s) => s.id === order.studentId)
      const studentOrdersCount = formalOrders.filter((o) => o.studentId === order.studentId).length
      const orderNumber = `${student?.name || "学生"}-${studentOrdersCount + 1}`

      const newOrder: FormalOrder = {
        ...order,
        id: Date.now().toString(),
        orderNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setFormalOrders((prev) => [newOrder, ...prev])
      addActivity({
        type: "order-update",
        description: `新增正式订单：${orderNumber}`,
        createdBy: user?.name || "系统",
      })
    },
    [students, formalOrders, user],
  )

  const updateFormalOrder = useCallback((id: string, updates: Partial<FormalOrder>) => {
    setFormalOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o))
    )
  }, [])

  const deleteFormalOrder = useCallback((id: string) => {
    setFormalOrders((prev) => prev.filter((o) => o.id !== id))
  }, [])

  // Daily Lead functions
  const addDailyLead = useCallback(
    (dailyLead: Omit<DailyLead, "id" | "createdAt" | "updatedAt">) => {
      const newDailyLead: DailyLead = {
        ...dailyLead,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setDailyLeads((prev) => [newDailyLead, ...prev])
    },
    [],
  )

  const updateDailyLead = useCallback((id: string, updates: Partial<DailyLead>) => {
    setDailyLeads((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d))
    )
  }, [])

  const deleteDailyLead = useCallback((id: string) => {
    setDailyLeads((prev) => prev.filter((d) => d.id !== id))
  }, [])

  // Wechat Account functions
  const addWechatAccount = useCallback(
    (account: Omit<WechatAccount, "id" | "createdAt" | "updatedAt">) => {
      const newAccount: WechatAccount = {
        ...account,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setWechatAccounts((prev) => [newAccount, ...prev])
    },
    [],
  )

  const updateWechatAccount = useCallback((id: string, updates: Partial<WechatAccount>) => {
    setWechatAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a))
    )
  }, [])

  const deleteWechatAccount = useCallback((id: string) => {
    setWechatAccounts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // Sales Personnel functions
  const addSalesPersonnel = useCallback(
    (personnel: Omit<SalesPersonnel, "id" | "createdAt" | "updatedAt">) => {
      const newPersonnel: SalesPersonnel = {
        ...personnel,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setSalesPersonnel((prev) => [newPersonnel, ...prev])
    },
    [],
  )

  const updateSalesPersonnel = useCallback((id: string, updates: Partial<SalesPersonnel>) => {
    setSalesPersonnel((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
    )
  }, [])

  const deleteSalesPersonnel = useCallback((id: string) => {
    setSalesPersonnel((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Transaction Record functions
  const addTransactionRecord = useCallback(
    (record: Omit<TransactionRecord, "id" | "createdAt">) => {
      const newRecord: TransactionRecord = {
        ...record,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setTransactionRecords((prev) => [newRecord, ...prev])
      addActivity({
        type: "note",
        description: `新增异动记录：${record.description}`,
        createdBy: user?.name || "系统",
      })
    },
    [user],
  )

  const updateTransactionRecord = useCallback((id: string, updates: Partial<TransactionRecord>) => {
    setTransactionRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }, [])

  const deleteTransactionRecord = useCallback((id: string) => {
    setTransactionRecords((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // System Dictionary functions
  const addSysDictionary = useCallback(
    (dict: Omit<SysDictionary, "id" | "createdAt" | "updatedAt">) => {
      const newDict: SysDictionary = {
        ...dict,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setSysDictionaries((prev) => [newDict, ...prev])
    },
    [],
  )

  const updateSysDictionary = useCallback((id: string, updates: Partial<SysDictionary>) => {
    setSysDictionaries((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d))
    )
  }, [])

  const deleteSysDictionary = useCallback((id: string) => {
    setSysDictionaries((prev) => prev.filter((d) => d.id !== id))
  }, [])

  // Activity functions
  const addActivity = useCallback((activity: Omit<Activity, "id" | "createdAt">) => {
    const newActivity: Activity = {
      ...activity,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    setActivities((prev) => [newActivity, ...prev])
  }, [])

  const value: AppContextType = {
    user,
    login,
    logout,
    leads,
    addLead,
    updateLead,
    deleteLead,
    teacherCandidates,
    addTeacherCandidate,
    updateTeacherCandidate,
    deleteTeacherCandidate,
    students,
    addStudent,
    updateStudent,
    deleteStudent,
    teachers,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    trialLessons,
    addTrialLesson,
    updateTrialLesson,
    deleteTrialLesson,
    formalOrders,
    addFormalOrder,
    updateFormalOrder,
    deleteFormalOrder,
    dailyLeads,
    addDailyLead,
    updateDailyLead,
    deleteDailyLead,
    wechatAccounts,
    addWechatAccount,
    updateWechatAccount,
    deleteWechatAccount,
    salesPersonnel,
    addSalesPersonnel,
    updateSalesPersonnel,
    deleteSalesPersonnel,
    transactionRecords,
    addTransactionRecord,
    updateTransactionRecord,
    deleteTransactionRecord,
    sysDictionaries,
    addSysDictionary,
    updateSysDictionary,
    deleteSysDictionary,
    activities,
    addActivity,
  }

  return (
    <AppContext.Provider value={value}>
      {children}
      <Toaster />
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
