import { createFileRoute } from '@tanstack/react-router'
import { db } from '../../db/index.js'
import { userProfiles } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { FOUNDER_USERNAME } from '../components/VerifiedBadge.js'

const RESERVED_USERNAMES = [
  'admin', 'support', 'neesh', 'ceo', 'official', 'system',
  'moderator', 'mod', 'staff', 'help', 'root', 'administrator',
  'noreply', 'contact', 'info', 'abuse', 'postmaster', 'webmaster',
]

const PROFANITY_LIST = [
  'fuck', 'shit', 'ass', 'bitch', 'dick', 'pussy', 'cock',
  'nigger', 'nigga', 'faggot', 'retard', 'slut', 'whore',
]

function validateUsername(raw: string): { valid: boolean; normalized?: string; error?: string } {
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_.]/g, '')
  if (normalized !== raw.toLowerCase()) {
    return { valid: false, error: 'Only letters, numbers, underscores, and periods allowed' }
  }
  if (normalized.length < 3) return { valid: false, error: 'Username must be at least 3 characters' }
  if (normalized.length > 20) return { valid: false, error: 'Username must be 20 characters or less' }
  if (normalized.startsWith('.') || normalized.endsWith('.')) {
    return { valid: false, error: 'Username cannot start or end with a period' }
  }
  if (normalized.includes('..')) {
    return { valid: false, error: 'Username cannot contain consecutive periods' }
  }
  if (RESERVED_USERNAMES.includes(normalized)) {
    return { valid: false, error: 'This username is reserved' }
  }
  if (normalized === FOUNDER_USERNAME) {
    return { valid: false, error: 'This username is reserved' }
  }
  if (PROFANITY_LIST.some((word) => normalized.includes(word))) {
    return { valid: false, error: 'This username is not allowed' }
  }
  return { valid: true, normalized }
}

export const Route = createFileRoute('/api/check-username')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const username = url.searchParams.get('username') || ''
        const result = validateUsername(username)
        if (!result.valid) {
          return Response.json({ available: false, error: result.error })
        }
        const [existing] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.username, result.normalized!))
          .limit(1)
        if (existing) {
          return Response.json({ available: false, error: 'Username is already taken' })
        }
        return Response.json({ available: true, normalized: result.normalized })
      },
    },
  },
})
