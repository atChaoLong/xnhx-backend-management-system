"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { DictionaryService, type DictionaryGroup } from "@/lib/services/dictionary"

interface DictionaryContextValue {
  dicts: DictionaryGroup | null
  isLoading: boolean
}

const DictionaryContext = createContext<DictionaryContextValue>({
  dicts: null,
  isLoading: true,
})

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const [dicts, setDicts] = useState<DictionaryGroup | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const result = await DictionaryService.getAllDictionaries()
        if (!cancelled) {
          setDicts(result)
        }
      } catch {
        // swallow — pages will fall back to empty maps
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return (
    <DictionaryContext.Provider value={{ dicts, isLoading }}>
      {children}
    </DictionaryContext.Provider>
  )
}

export function useDictionaryContext() {
  return useContext(DictionaryContext)
}

/** Convenience: build a code→label map from a dictionary category */
export function useDictionaryMap(category: string): Map<string, string> {
  const { dicts } = useDictionaryContext()
  if (!dicts) return new Map()
  const items = dicts[category]
  if (!items) return new Map()
  return new Map(items.map((item) => [item.code, item.label]))
}
