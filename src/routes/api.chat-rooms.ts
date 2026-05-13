import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { chatRooms } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/chat-rooms')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { interest } = await request.json()
        if (!interest) return new Response('Bad request', { status: 400 })
        const normalized = interest.toLowerCase().trim()
        let room = await db
          .select()
          .from(chatRooms)
          .where(eq(chatRooms.interest, normalized))
          .limit(1)
        if (!room.length) {
          const [created] = await db
            .insert(chatRooms)
            .values({ name: `#${normalized}`, interest: normalized })
            .returning()
          room = [created]
        }
        return Response.json(room[0])
      },
    },
  },
})
