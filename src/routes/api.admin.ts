import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { userProfiles, userBans, adminAuditLogs, communityMessages, chatMessages, directMessages, premiumMessages } from '../../db/schema.js'
import { eq, desc } from 'drizzle-orm'

const OWNER_USERNAME = 'ceo'

async function verifyOwner() {
  const user = await getUser()
  if (!user) return null
  const [profile] = await db
    .select({ username: userProfiles.username })
    .from(userProfiles)
    .where(eq(userProfiles.netlifyId, user.id))
    .limit(1)
  if (!profile || profile.username !== OWNER_USERNAME) return null
  return user
}

export const Route = createFileRoute('/api/admin')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const owner = await verifyOwner()
        if (!owner) return new Response('Forbidden', { status: 403 })

        const url = new URL(request.url)
        const action = url.searchParams.get('action')

        if (action === 'ban-status') {
          const targetId = url.searchParams.get('userId')
          if (!targetId) return new Response('Missing userId', { status: 400 })
          const [ban] = await db
            .select()
            .from(userBans)
            .where(eq(userBans.netlifyId, targetId))
            .limit(1)
          return Response.json({ banned: !!ban, ban: ban || null })
        }

        if (action === 'audit-logs') {
          const logs = await db
            .select()
            .from(adminAuditLogs)
            .orderBy(desc(adminAuditLogs.createdAt))
            .limit(100)
          return Response.json(logs)
        }

        return new Response('Unknown action', { status: 400 })
      },

      POST: async ({ request }) => {
        const owner = await verifyOwner()
        if (!owner) return new Response('Forbidden', { status: 403 })

        const data = await request.json()
        const { action } = data

        if (action === 'ban-user') {
          const { userId, reason, permanent, expiresAt } = data
          if (!userId) return new Response('Missing userId', { status: 400 })

          const [targetProfile] = await db
            .select({ username: userProfiles.username })
            .from(userProfiles)
            .where(eq(userProfiles.netlifyId, userId))
            .limit(1)
          if (targetProfile?.username === OWNER_USERNAME) {
            return Response.json({ error: 'Cannot ban the owner account' }, { status: 400 })
          }

          await db.delete(userBans).where(eq(userBans.netlifyId, userId))
          await db.insert(userBans).values({
            netlifyId: userId,
            reason: reason || '',
            permanent: permanent !== false,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            bannedBy: owner.id,
          })

          await db.insert(adminAuditLogs).values({
            adminId: owner.id,
            action: 'ban_user',
            targetUserId: userId,
            details: JSON.stringify({ reason, permanent: permanent !== false, expiresAt }),
          })

          return Response.json({ success: true })
        }

        if (action === 'unban-user') {
          const { userId } = data
          if (!userId) return new Response('Missing userId', { status: 400 })

          await db.delete(userBans).where(eq(userBans.netlifyId, userId))

          await db.insert(adminAuditLogs).values({
            adminId: owner.id,
            action: 'unban_user',
            targetUserId: userId,
          })

          return Response.json({ success: true })
        }

        if (action === 'delete-message') {
          const { messageId, messageType } = data
          if (!messageId || !messageType) return new Response('Missing messageId or messageType', { status: 400 })

          const tables: Record<string, any> = {
            community: communityMessages,
            chat: chatMessages,
            direct: directMessages,
            premium: premiumMessages,
          }
          const table = tables[messageType]
          if (!table) return new Response('Invalid messageType', { status: 400 })

          await db.delete(table).where(eq(table.id, messageId))

          await db.insert(adminAuditLogs).values({
            adminId: owner.id,
            action: 'delete_message',
            targetMessageId: messageId,
            messageType,
          })

          return Response.json({ success: true })
        }

        if (action === 'grant-neesh-plus') {
          const { userId } = data
          if (!userId) return new Response('Missing userId', { status: 400 })

          await db
            .update(userProfiles)
            .set({
              subscriptionTier: 'neesh_plus',
              isPremium: true,
              premiumSince: new Date(),
              premiumExpires: null,
              updatedAt: new Date(),
            })
            .where(eq(userProfiles.netlifyId, userId))

          await db.insert(adminAuditLogs).values({
            adminId: owner.id,
            action: 'grant_neesh_plus',
            targetUserId: userId,
            details: JSON.stringify({ subscriptionSource: 'owner_granted' }),
          })

          return Response.json({ success: true })
        }

        if (action === 'remove-neesh-plus') {
          const { userId } = data
          if (!userId) return new Response('Missing userId', { status: 400 })

          await db
            .update(userProfiles)
            .set({
              subscriptionTier: 'free',
              isPremium: false,
              premiumExpires: null,
              updatedAt: new Date(),
            })
            .where(eq(userProfiles.netlifyId, userId))

          await db.insert(adminAuditLogs).values({
            adminId: owner.id,
            action: 'remove_neesh_plus',
            targetUserId: userId,
          })

          return Response.json({ success: true })
        }

        return new Response('Unknown action', { status: 400 })
      },
    },
  },
})
