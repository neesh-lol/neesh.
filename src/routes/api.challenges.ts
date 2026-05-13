import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { userChallenges } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { CHALLENGES } from '../lib/xp.js'

export const Route = createFileRoute('/api/challenges')({
  server: {
    handlers: {
      GET: async () => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const progress = await db
          .select()
          .from(userChallenges)
          .where(eq(userChallenges.netlifyId, user.id))

        const progressMap = new Map(progress.map((p) => [p.challengeKey, p]))

        const result = CHALLENGES.map((c) => {
          const p = progressMap.get(c.key)
          return {
            ...c,
            progress: p?.progress ?? 0,
            completed: p?.completed ?? false,
            completedAt: p?.completedAt ?? null,
          }
        })

        return Response.json(result)
      },
    },
  },
})
