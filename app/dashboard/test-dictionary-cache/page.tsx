import { notFound } from "next/navigation"
import { DictionaryCacheTestClient } from "./dictionary-cache-test-client"

export default function DictionaryCacheTestPage() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEBUG_API === "true"

  if (!enabled) {
    notFound()
  }

  return <DictionaryCacheTestClient />
}
