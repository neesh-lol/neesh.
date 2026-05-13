import type { Handler } from '@netlify/functions'

const handler: Handler = async (event) => {
  try {
    const user = JSON.parse(event.body || '{}')
    const { db } = await import('../../db/index.js')
    const { userProfiles } = await import('../../db/schema.js')
    await db.insert(userProfiles).values({
      netlifyId: user.id,
      displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      username: user.user_metadata?.username || null,
      bio: '',
      avatarUrl: '',
      interests: [],
      onboardingComplete: true,
    }).onConflictDoNothing()
  } catch (e) {
    // Never block signup — profile will be created lazily on first login
  }

  return {
    statusCode: 200,
    body: JSON.stringify({}),
  }
}

export { handler }
