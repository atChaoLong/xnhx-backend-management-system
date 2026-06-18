import { notFound } from "next/navigation"
import { PermissionsDebugClient } from "./permissions-debug-client"

export default function DebugPermissionsPage() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEBUG_API === "true"

  if (!enabled) {
    notFound()
  }

  return <PermissionsDebugClient />
}
