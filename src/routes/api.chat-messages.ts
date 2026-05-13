import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { chatMessages, userProfiles, messageReactions } from '../../db/schema.js'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { processMessageXp } from '../lib/xp.js'
import { FOUNDER_USERNAME } from '../components/VerifiedBadge.js'
import { extractAndSaveMentions } from '../lib/mentions.js'

export const Route = createFileRoute('/api/chat-messages')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const roomId = parseInt(url.searchParams.get('roomId') ?? '0')
        if (!roomId) return new Response('Bad request', { status: 400 })
        const messages = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.roomId, roomId))
          .orderBy(desc(chatMessages.createdAt))
          .limit(100)
        const reversed = messages.reverse()
        if (!reversed.length) return Response.json({ messages: [], reactions: {}, founderUserId: null, premiumUserIds: [] })
        const msgIds = reversed.map((m) => m.id)
        const reactions = await db
          .select()
          .from(messageReactions)
          .where(and(eq(messageReactions.messageType, 'chat'), inArray(messageReactions.messageId, msgIds)))
        const reactionMap: Record<number, Array<{ emoji: string; userId: string; displayName: string }>> = {}
        for (const r of reactions) {
          if (!reactionMap[r.messageId]) reactionMap[r.messageId] = []
          reactionMap[r.messageId].push({ emoji: r.emoji, userId: r.userId, displayName: r.displayName })
        }
        const [founder] = await db
          .select({ netlifyId: userProfiles.netlifyId })
          .from(userProfiles)
          .where(eq(userProfiles.username, FOUNDER_USERNAME))
          .limit(1)
        const uniqueUserIds = [...new Set(reversed.map(m => m.userId))]
        const premiumProfiles = uniqueUserIds.length > 0
          ? await db
              .select({ netlifyId: userProfiles.netlifyId })
              .from(userProfiles)
              .where(and(eq(userProfiles.isPremium, true), inArray(userProfiles.netlifyId, uniqueUserIds)))
          : []
        const premiumUserIds = premiumProfiles.map(p => p.netlifyId)
        return Response.json({ messages: reversed, reactions: reactionMap, founderUserId: founder?.netlifyId ?? null, premiumUserIds })
      },
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { roomId, content, replyToId } = await request.json()
        if (!roomId || !content?.trim()) return new Response('Bad request', { status: 400 })
        const profile = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)
        const displayName = profile[0]?.displayName ?? user.name ?? user.email
        const avatarUrl = profile[0]?.avatarUrl ?? ''
        const [msg] = await db
          .insert(chatMessages)
          .values({
            roomId,
            userId: user.id,
            displayName,
            avatarUrl,
            content: content.trim(),
            replyToId: replyToId || null,
          })
          .returning()
        if (profile[0]) {
          await processMessageXp(user.id, 2)
        }
        await extractAndSaveMentions(content.trim(), user.id, displayName, 'chat', msg.id, roomId)
        return Response.json(msg, { status: 201 })
      },
      DELETE: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const url = new URL(request.url)
        const messageId = parseInt(url.searchParams.get('messageId') ?? '0')
        if (!messageId) return new Response('Bad request', { status: 400 })
        const [msg] = await db
          .select()
          .from(chatMessages)
          .where(and(eq(chatMessages.id, messageId), eq(chatMessages.userId, user.id)))
          .limit(1)
        if (!msg) return new Response('Not found', { status: 404 })
        await db
          .delete(messageReactions)
          .where(and(eq(messageReactions.messageType, 'chat'), eq(messageReactions.messageId, messageId)))
        await db.delete(chatMessages).where(eq(chatMessages.id, messageId))
        return Response.json({ deleted: true })
      },
    },
  },
})
