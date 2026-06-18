import { notFound } from "next/navigation"
import { SignupClient } from "./signup-client"

function isPublicSignupEnabled() {
  return process.env.ENABLE_PUBLIC_SIGNUP === "true"
}

export default function SignupPage() {
  if (!isPublicSignupEnabled()) {
    notFound()
  }

  return <SignupClient />
}
