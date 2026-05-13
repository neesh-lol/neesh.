import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { typingIndicators, userProfiles } from '../../db/schema.js'
import { eq, and, lt } from 'drizzle-orm'

export const Route = createFileRoute('/api/typing')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const roomType = url.searchParams.get('roomType') ?? ''
        const roomId = url.searchParams.get('roomId') ? parseInt(url.searchParams.get('roomId')!) : null
        const excludeUserId = url.searchParams.get('excludeUserId') ?? ''
        const cutoff = new Date(Date.now() - 5000)
        await db.delete(typingIndicators).where(lt(typingIndicators.updatedAt, cutoff))
        let conditions = [eq(typingIndicators.roomType, roomType)]
        if (roomId) conditions.push(eq(typingIndicators.roomId, roomId))
        const typers = await db
          .select({ userId: typingIndicators.userId, displayName: typingIndicators.displayName })
          .from(typingIndicators)
          .where(and(...conditions))
        return Response.json(typers.filter((t) => t.userId !== excludeUserId))
      },
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { roomType, roomId } = await request.json()
        if (!roomType) return new Response('Bad request', { status: 400 })
        const profile = await db.select().from(userProfiles).where(eq(userProfiles.netlifyId, user.id)).limit(1)
        const displayName = profile[0]?.displayName ?? user.name ?? user.email
        const existing = await db
          .select()
          .from(typingIndicators)
          .where(
            and(
              eq(typingIndicators.roomType, roomType),
              eq(typingIndicators.userId, user.id),
              roomId ? eq(typingIndicators.roomId, roomId) : undefined,
            ),
          )
          .limit(1)
        if (existing.length) {
          await db
            .update(typingIndicators)
            .set({ updatedAt: new Date(), displayName })
            .where(eq(typingIndicators.id, existing[0].id))
        } else {
          await db.insert(typingIndicators).values({ roomType, roomId, userId: user.id, displayName })
        }
        return Response.json({ ok: true })
      },
    },
  },
})
