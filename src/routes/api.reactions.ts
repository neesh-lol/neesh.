import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { messageReactions, userProfiles } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export const Route = createFileRoute('/api/reactions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const messageType = url.searchParams.get('messageType')
        const messageId = parseInt(url.searchParams.get('messageId') ?? '0')
        if (!messageType || !messageId) return new Response('Bad request', { status: 400 })
        const reactions = await db
          .select()
          .from(messageReactions)
          .where(and(eq(messageReactions.messageType, messageType), eq(messageReactions.messageId, messageId)))
        return Response.json(reactions)
      },
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { messageType, messageId, emoji } = await request.json()
        if (!messageType || !messageId || !emoji) return new Response('Bad request', { status: 400 })
        const profile = await db.select().from(userProfiles).where(eq(userProfiles.netlifyId, user.id)).limit(1)
        const displayName = profile[0]?.displayName ?? user.name ?? user.email
        const existing = await db
          .select()
          .from(messageReactions)
          .where(
            and(
              eq(messageReactions.messageType, messageType),
              eq(messageReactions.messageId, messageId),
              eq(messageReactions.userId, user.id),
              eq(messageReactions.emoji, emoji),
            ),
          )
          .limit(1)
        if (existing.length) {
          await db.delete(messageReactions).where(eq(messageReactions.id, existing[0].id))
          return Response.json({ removed: true })
        }
        const [reaction] = await db
          .insert(messageReactions)
          .values({ messageType, messageId, userId: user.id, displayName, emoji })
          .returning()
        return Response.json(reaction, { status: 201 })
      },
    },
  },
})
