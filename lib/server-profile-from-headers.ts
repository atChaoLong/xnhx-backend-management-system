/**
 * Reads user profile from headers injected by middleware.
 * This avoids a redundant DB lookup on every API request — the middleware already
 * authenticated the user and looked up the profile; we just read it from headers.
 */

import { NextRequest } from "next/server"
import { getCurrentProfile, type CurrentProfile } from "@/lib/server-data-scope"

const HEADER_USER_ID = "x-user-id"
const HEADER_USER_ROLE = "x-user-role"
const HEADER_USER_NAME = "x-user-name"

export function setProfileHeaders(
  headers: Headers,
  profile: CurrentProfile
): void {
  headers.set(HEADER_USER_ID, profile.id)
  if (profile.role) headers.set(HEADER_USER_ROLE, profile.role)
  if (profile.name) headers.set(HEADER_USER_NAME, encodeURIComponent(profile.name))
}

export async function getProfileFromHeaders(
  request: NextRequest
): Promise<CurrentProfile | null> {
  const id = request.headers.get(HEADER_USER_ID)
  const role = request.headers.get(HEADER_USER_ROLE)
  const name = request.headers.get(HEADER_USER_NAME)

  if (id) {
    const decodedName = name ? decodeURIComponent(name) : null
    return { id, role: role || "sales", name: decodedName }
  }

  // Fallback: headers not set (e.g., called directly without middleware)
  return getCurrentProfile(request)
}
