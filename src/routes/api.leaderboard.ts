import { createFileRoute } from '@tanstack/react-router'
import { db } from '../../db/index.js'
import { userProfiles } from '../../db/schema.js'
import { desc } from 'drizzle-orm'

export const Route = createFileRoute('/api/leaderboard')({
  server: {
    handlers: {
      GET: async () => {
        const top = await db
          .select({
            id: userProfiles.id,
            netlifyId: userProfiles.netlifyId,
            displayName: userProfiles.displayName,
            username: userProfiles.username,
            avatarUrl: userProfiles.avatarUrl,
            interests: userProfiles.interests,
            messageCount: userProfiles.messageCount,
            totalXp: userProfiles.totalXp,
            currentStreak: userProfiles.currentStreak,
            longestStreak: userProfiles.longestStreak,
            isPremium: userProfiles.isPremium,
            isFounderOverride: userProfiles.isFounderOverride,
          })
          .from(userProfiles)
          .orderBy(desc(userProfiles.totalXp))
          .limit(50)
        return Response.json(top)
      },
    },
  },
})
