import type { Config } from '@netlify/functions'
import { db } from '../../db/index.js'
import { userProfiles, matchGroups, matchGroupMembers } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

export default async () => {
  const optedIn = await db
    .select({ netlifyId: userProfiles.netlifyId })
    .from(userProfiles)
    .where(eq(userProfiles.weeklyMatchOptIn, true))

  if (optedIn.length < 2) return new Response('Not enough users opted in')

  const shuffled = optedIn.sort(() => Math.random() - 0.5)
  const groupSize = 5
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  for (let i = 0; i < shuffled.length; i += groupSize) {
    const chunk = shuffled.slice(i, i + groupSize)
    if (chunk.length < 2) break

    const [group] = await db
      .insert(matchGroups)
      .values({ expiresAt })
      .returning()

    for (const member of chunk) {
      await db.insert(matchGroupMembers).values({
        groupId: group.id,
        netlifyId: member.netlifyId,
      })
    }
  }

  return new Response('Match groups created')
}

export const config: Config = {
  schedule: '0 12 * * 0',
}
