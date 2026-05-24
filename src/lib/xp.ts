import { db } from '../../db/index.js'
import { userProfiles, userChallenges } from '../../db/schema.js'
import { eq, sql } from 'drizzle-orm'

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function getDayBeforeYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 2)
  return d.toISOString().slice(0, 10)
}

function dailyXp(streak: number): number {
  return Math.min(streak * 100, 400)
}

async function awardBadge(netlifyId: string, badgeId: string) {
  try {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.netlifyId, netlifyId))
      .limit(1)

    if (!profile?.id) return

    await db.execute(sql`
      insert into public.user_badges (user_id, badge_id)
      values (${profile.id}, ${badgeId})
      on conflict do nothing
    `)
  } catch (error) {
    console.error(`Failed to award badge ${badgeId}:`, error)
  }
}

async function awardMessageBadges(netlifyId: string, messageCount: number) {
  if (messageCount >= 1) {
    await awardBadge(netlifyId, 'first_message')
  }

  if (messageCount >= 100) {
    await awardBadge(netlifyId, 'hundred_messages')
  }

  if (messageCount >= 1000) {
    await awardBadge(netlifyId, 'thousand_messages')
  }

  if (messageCount >= 10000) {
    await awardBadge(netlifyId, 'ten_thousand_messages')
  }
}

async function awardStreakBadges(netlifyId: string, streak: number) {
  if (streak >= 7) {
    await awardBadge(netlifyId, 'seven_day_streak')
  }

  if (streak >= 30) {
    await awardBadge(netlifyId, 'thirty_day_streak')
  }

  if (streak >= 50) {
    await awardBadge(netlifyId, 'fifty_day_streak')
  }

  if (streak >= 100) {
    await awardBadge(netlifyId, 'hundred_day_streak')
  }

  if (streak >= 365) {
    await awardBadge(netlifyId, 'year_streak')
  }
}

export async function processMessageXp(
  netlifyId: string,
  baseXp: number,
): Promise<{ totalXp: number; currentStreak: number; dailyBonus: number }> {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.netlifyId, netlifyId))
    .limit(1)

  if (!profile) return { totalXp: 0, currentStreak: 0, dailyBonus: 0 }

  const today = getToday()
  const yesterday = getYesterday()
  const dayBefore = getDayBeforeYesterday()

  let dailyBonus = 0
  let newStreak = profile.currentStreak
  let newLongest = profile.longestStreak

  if (profile.lastActiveDate !== today) {
    if (profile.lastActiveDate === yesterday) {
      newStreak = profile.currentStreak + 1
    } else if (profile.isPremium && profile.lastActiveDate === dayBefore) {
      const currentMonth = new Date().toISOString().slice(0, 7)
      const freezeUsed =
        profile.streakFreezeResetMonth === currentMonth
          ? profile.streakFreezeUsed
          : 0

      if (freezeUsed < 3) {
        newStreak = profile.currentStreak + 1

        await db
          .update(userProfiles)
          .set({
            streakFreezeUsed: freezeUsed + 1,
            streakFreezeResetMonth: currentMonth,
          })
          .where(eq(userProfiles.netlifyId, netlifyId))
      } else {
        newStreak = 1
      }
    } else {
      newStreak = 1
    }

    dailyBonus = dailyXp(newStreak)
    newLongest = Math.max(newLongest, newStreak)
  }

  const newTotalXp = profile.totalXp + baseXp + dailyBonus
  const newMessageCount = profile.messageCount + 1

  await db
    .update(userProfiles)
    .set({
      totalXp: newTotalXp,
      score: newTotalXp,
      messageCount: newMessageCount,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.netlifyId, netlifyId))

  await awardMessageBadges(netlifyId, newMessageCount)
  await awardStreakBadges(netlifyId, newStreak)

  await updateChallengeProgress(netlifyId, 'send_first_message', newMessageCount)
  await updateChallengeProgress(netlifyId, 'send_100_messages', newMessageCount)
  await updateChallengeProgress(netlifyId, 'send_1000_messages', newMessageCount)
  await updateChallengeProgress(netlifyId, 'streak_7', newStreak)
  await updateChallengeProgress(netlifyId, 'streak_30', newStreak)
  await updateChallengeProgress(netlifyId, 'streak_50', newStreak)
  await updateChallengeProgress(netlifyId, 'streak_100', newStreak)
  await updateChallengeProgress(netlifyId, 'streak_365', newStreak)

  return {
    totalXp: newTotalXp,
    currentStreak: newStreak,
    dailyBonus,
  }
}

export interface ChallengeDefinition {
  key: string
  name: string
  description: string
  xpReward: number
  target: number
  category: 'social' | 'messaging' | 'streak' | 'profile'
}

export const CHALLENGES: ChallengeDefinition[] = [
  {
    key: 'send_first_message',
    name: 'First Words',
    description: 'Send your first message',
    xpReward: 50,
    target: 1,
    category: 'messaging',
  },
  {
    key: 'send_100_messages',
    name: 'Chatterbox',
    description: 'Send 100 messages',
    xpReward: 500,
    target: 100,
    category: 'messaging',
  },
  {
    key: 'send_1000_messages',
    name: 'Motormouth',
    description: 'Send 1,000 messages',
    xpReward: 2000,
    target: 1000,
    category: 'messaging',
  },
  {
    key: 'streak_7',
    name: 'On Fire',
    description: 'Reach a 7-day streak',
    xpReward: 300,
    target: 7,
    category: 'streak',
  },
  {
    key: 'streak_30',
    name: 'Unstoppable',
    description: 'Reach a 30-day streak',
    xpReward: 1500,
    target: 30,
    category: 'streak',
  },
  {
    key: 'streak_50',
    name: 'Half Century',
    description: 'Reach a 50-day streak',
    xpReward: 3000,
    target: 50,
    category: 'streak',
  },
  {
    key: 'streak_100',
    name: 'Centurion',
    description: 'Reach a 100-day streak',
    xpReward: 5000,
    target: 100,
    category: 'streak',
  },
  {
    key: 'streak_365',
    name: 'Legendary',
    description: 'Reach a 1-year streak',
    xpReward: 15000,
    target: 365,
    category: 'streak',
  },
  {
    key: 'customize_profile',
    name: 'Looking Good',
    description: 'Customize your profile',
    xpReward: 50,
    target: 1,
    category: 'profile',
  },
  {
    key: 'add_first_friend',
    name: 'Social Butterfly',
    description: 'Add your first friend',
    xpReward: 100,
    target: 1,
    category: 'social',
  },
  {
    key: 'add_10_friends',
    name: 'Networking',
    description: 'Add 10 friends',
    xpReward: 500,
    target: 10,
    category: 'social',
  },
  {
    key: 'add_50_friends',
    name: 'Popular',
    description: 'Add 50 friends',
    xpReward: 2000,
    target: 50,
    category: 'social',
  },
  {
    key: 'add_100_friends',
    name: 'Celebrity',
    description: 'Add 100 friends',
    xpReward: 5000,
    target: 100,
    category: 'social',
  },
]

async function updateChallengeProgress(
  netlifyId: string,
  challengeKey: string,
  progress: number,
) {
  const challenge = CHALLENGES.find((c) => c.key === challengeKey)
  if (!challenge) return

  const [row] = await db
    .select()
    .from(userChallenges)
    .where(
      sql`${userChallenges.netlifyId} = ${netlifyId} AND ${userChallenges.challengeKey} = ${challengeKey}`,
    )
    .limit(1)

  if (!row) {
    const completed = progress >= challenge.target

    await db
      .insert(userChallenges)
      .values({
        netlifyId,
        challengeKey,
        progress: Math.min(progress, challenge.target),
        completed,
        completedAt: completed ? new Date() : undefined,
      })
      .onConflictDoNothing()

    if (completed) {
      await db
        .update(userProfiles)
        .set({
          totalXp: sql`${userProfiles.totalXp} + ${challenge.xpReward}`,
          score: sql`${userProfiles.score} + ${challenge.xpReward}`,
        })
        .where(eq(userProfiles.netlifyId, netlifyId))
    }
  } else if (!row.completed) {
    const newProgress = Math.min(progress, challenge.target)
    const completed = newProgress >= challenge.target

    await db
      .update(userChallenges)
      .set({
        progress: newProgress,
        completed,
        completedAt: completed ? new Date() : undefined,
      })
      .where(
        sql`${userChallenges.netlifyId} = ${netlifyId} AND ${userChallenges.challengeKey} = ${challengeKey}`,
      )

    if (completed) {
      await db
        .update(userProfiles)
        .set({
          totalXp: sql`${userProfiles.totalXp} + ${challenge.xpReward}`,
          score: sql`${userProfiles.score} + ${challenge.xpReward}`,
        })
        .where(eq(userProfiles.netlifyId, netlifyId))
    }
  }
}

export { updateChallengeProgress }
