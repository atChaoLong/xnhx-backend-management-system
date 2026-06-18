import { notFound } from "next/navigation"
import { AuthDebugClient } from "./auth-debug-client"

export default function AuthDebugPage() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEBUG_API === "true"

  if (!enabled) {
    notFound()
  }

  return <AuthDebugClient />
}
