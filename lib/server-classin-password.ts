import { randomInt } from "crypto"

export function generateClassInInitialPassword(length = 8): string {
  const safeLength = Math.max(1, Math.floor(length))
  const firstDigit = randomInt(1, 10).toString()

  if (safeLength === 1) {
    return firstDigit
  }

  const remainingDigits = Array.from({ length: safeLength - 1 }, () =>
    randomInt(0, 10).toString()
  ).join("")

  return `${firstDigit}${remainingDigits}`
}

export function resolveClassInInitialPassword(
  ...candidates: Array<string | null | undefined>
): string {
  const configuredPassword = candidates
    .map(candidate => candidate?.trim())
    .find(Boolean)

  return configuredPassword || generateClassInInitialPassword()
}
