const TOXIC_PATTERNS = [
  /\bn[i1]gg[ae3]r?s?\b/i,
  /\bf[a@]gg?[o0]t?s?\b/i,
  /\bk[i1]ll\s*(your|ur)?\s*self\b/i,
  /\bkys\b/i,
  /\br[e3]t[a@]rd(ed|s)?\b/i,
  /\btr[a@]nn(y|ie)s?\b/i,
  /\bgo\s+die\b/i,
]

export function containsToxicContent(text: string): boolean {
  return TOXIC_PATTERNS.some((p) => p.test(text))
}

const SPAM_COOLDOWN_MS = 2000

let lastSendTime = 0

export function checkSpamCooldown(): { allowed: boolean; remainingMs: number } {
  const now = Date.now()
  const elapsed = now - lastSendTime
  if (elapsed < SPAM_COOLDOWN_MS) {
    return { allowed: false, remainingMs: SPAM_COOLDOWN_MS - elapsed }
  }
  return { allowed: true, remainingMs: 0 }
}

export function markMessageSent() {
  lastSendTime = Date.now()
}

export const REACTION_EMOJIS = ['❤️', '👍', '😢', '💀', '🔥', '👀']

export function getRecentInterests(): string[] {
  try {
    return JSON.parse(localStorage.getItem('neesh_recent_interests') ?? '[]')
  } catch {
    return []
  }
}

export function addRecentInterest(interest: string) {
  const recent = getRecentInterests().filter((i) => i !== interest)
  recent.unshift(interest)
  localStorage.setItem('neesh_recent_interests', JSON.stringify(recent.slice(0, 10)))
}

export function getMutedUsers(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('neesh_muted_users') ?? '[]'))
  } catch {
    return new Set()
  }
}

export function toggleMuteUser(userId: string): boolean {
  const muted = getMutedUsers()
  if (muted.has(userId)) {
    muted.delete(userId)
    localStorage.setItem('neesh_muted_users', JSON.stringify([...muted]))
    return false
  }
  muted.add(userId)
  localStorage.setItem('neesh_muted_users', JSON.stringify([...muted]))
  return true
}

export function getBlockedUsers(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('neesh_blocked_users') ?? '[]'))
  } catch {
    return new Set()
  }
}

export function setBlockedUsers(blocks: string[]) {
  localStorage.setItem('neesh_blocked_users', JSON.stringify(blocks))
}
