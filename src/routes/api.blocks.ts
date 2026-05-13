import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { userBlocks } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export const Route = createFileRoute('/api/blocks')({
  server: {
    handlers: {
      GET: async () => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const blocks = await db
          .select()
          .from(userBlocks)
          .where(eq(userBlocks.blockerId, user.id))
        return Response.json(blocks)
      },
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { blockedId, action } = await request.json()
        if (!blockedId) return new Response('Bad request', { status: 400 })
        if (action === 'unblock') {
          await db
            .delete(userBlocks)
            .where(and(eq(userBlocks.blockerId, user.id), eq(userBlocks.blockedId, blockedId)))
          return Response.json({ unblocked: true })
        }
        const existing = await db
          .select()
          .from(userBlocks)
          .where(and(eq(userBlocks.blockerId, user.id), eq(userBlocks.blockedId, blockedId)))
          .limit(1)
        if (existing.length) return Response.json({ alreadyBlocked: true })
        const [block] = await db
          .insert(userBlocks)
          .values({ blockerId: user.id, blockedId })
          .returning()
        return Response.json(block, { status: 201 })
      },
    },
  },
})
