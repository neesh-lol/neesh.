import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { directMessages, dmReadCursors, friendships, mentions } from '../../db/schema.js'
import { eq, and, or, gt, sql } from 'drizzle-orm'

export const Route = createFileRoute('/api/notifications')({
  server: {
    handlers: {
      GET: async () => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const cursors = await db
          .select()
          .from(dmReadCursors)
          .where(eq(dmReadCursors.userId, user.id))

        const cursorMap = new Map(cursors.map((c) => [c.partnerId, c.lastReadMessageId]))

        const received = await db
          .select({ senderId: directMessages.senderId, id: directMessages.id })
          .from(directMessages)
          .where(eq(directMessages.receiverId, user.id))

        let unreadDms = 0
        for (const msg of received) {
          const cursor = cursorMap.get(msg.senderId) ?? 0
          if (msg.id > cursor) unreadDms++
        }

        const pendingFriends = await db
          .select()
          .from(friendships)
          .where(and(eq(friendships.addresseeId, user.id), eq(friendships.status, 'pending')))

        const unreadMentions = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(mentions)
          .where(and(eq(mentions.mentionedUserId, user.id), eq(mentions.read, false)))

        return Response.json({
          unreadDms,
          pendingFriends: pendingFriends.length,
          unreadMentions: unreadMentions[0]?.count ?? 0,
        })
      },
    },
  },
})
