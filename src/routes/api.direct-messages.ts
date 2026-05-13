import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { directMessages, userProfiles, dmReadCursors } from '../../db/schema.js'
import { eq, or, and, desc, inArray } from 'drizzle-orm'
import { FOUNDER_USERNAME } from '../components/VerifiedBadge.js'
import { extractAndSaveMentions } from '../lib/mentions.js'

export const Route = createFileRoute('/api/direct-messages')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const url = new URL(request.url)
        const partnerId = url.searchParams.get('partnerId')

        if (partnerId) {
          const messages = await db
            .select()
            .from(directMessages)
            .where(
              or(
                and(eq(directMessages.senderId, user.id), eq(directMessages.receiverId, partnerId)),
                and(eq(directMessages.senderId, partnerId), eq(directMessages.receiverId, user.id)),
              ),
            )
            .orderBy(desc(directMessages.createdAt))
            .limit(100)
          const reversed = messages.reverse()
          const [founder] = await db
            .select({ netlifyId: userProfiles.netlifyId })
            .from(userProfiles)
            .where(eq(userProfiles.username, FOUNDER_USERNAME))
            .limit(1)

          if (reversed.length) {
            const lastReceivedMsg = reversed.filter((m) => m.senderId === partnerId).pop()
            if (lastReceivedMsg) {
              await db
                .insert(dmReadCursors)
                .values({ userId: user.id, partnerId, lastReadMessageId: lastReceivedMsg.id })
                .onConflictDoUpdate({
                  target: [dmReadCursors.userId, dmReadCursors.partnerId],
                  set: { lastReadMessageId: lastReceivedMsg.id, updatedAt: new Date() },
                })
            }
          }

          return Response.json({ messages: reversed, founderUserId: founder?.netlifyId ?? null })
        }

        const allDms = await db
          .select()
          .from(directMessages)
          .where(or(eq(directMessages.senderId, user.id), eq(directMessages.receiverId, user.id)))
          .orderBy(desc(directMessages.createdAt))
          .limit(500)

        const convMap = new Map<string, typeof allDms[0]>()
        for (const dm of allDms) {
          const pid = dm.senderId === user.id ? dm.receiverId : dm.senderId
          if (!convMap.has(pid)) convMap.set(pid, dm)
        }

        const partnerIds = [...convMap.keys()]
        let profiles: any[] = []
        if (partnerIds.length > 0) {
          profiles = await db
            .select({
              netlifyId: userProfiles.netlifyId,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              avatarUrl: userProfiles.avatarUrl,
            })
            .from(userProfiles)
            .where(inArray(userProfiles.netlifyId, partnerIds))
        }
        const profileMap = new Map(profiles.map((p: any) => [p.netlifyId, p]))

        const cursors = await db
          .select()
          .from(dmReadCursors)
          .where(eq(dmReadCursors.userId, user.id))
        const cursorMap = new Map(cursors.map((c) => [c.partnerId, c.lastReadMessageId]))

        const conversations = partnerIds.map((id) => {
          const profile = profileMap.get(id)
          const lastMsg = convMap.get(id)!
          const cursor = cursorMap.get(id) ?? 0
          const unreadCount = allDms.filter(
            (dm) => dm.senderId === id && dm.receiverId === user.id && dm.id > cursor,
          ).length
          return {
            partnerId: id,
            displayName: profile?.displayName ?? lastMsg.senderDisplayName,
            username: profile?.username ?? null,
            avatarUrl: profile?.avatarUrl ?? '',
            lastMessage: lastMsg.content,
            lastMessageAt: lastMsg.createdAt,
            isLastFromMe: lastMsg.senderId === user.id,
            unreadCount,
          }
        })

        return Response.json({ conversations })
      },

      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { receiverId, content } = await request.json()
        if (!receiverId || !content?.trim()) return new Response('Bad request', { status: 400 })

        const [profile] = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)
        const displayName = profile?.displayName ?? user.name ?? user.email
        const avatarUrl = profile?.avatarUrl ?? ''

        const [msg] = await db
          .insert(directMessages)
          .values({
            senderId: user.id,
            receiverId,
            senderDisplayName: displayName,
            senderAvatarUrl: avatarUrl,
            content: content.trim(),
          })
          .returning()

        await extractAndSaveMentions(content.trim(), user.id, displayName, 'direct', msg.id)

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
          .from(directMessages)
          .where(and(eq(directMessages.id, messageId), eq(directMessages.senderId, user.id)))
          .limit(1)
        if (!msg) return new Response('Not found', { status: 404 })
        await db.delete(directMessages).where(eq(directMessages.id, messageId))
        return Response.json({ deleted: true })
      },
    },
  },
})
