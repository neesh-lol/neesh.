import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { reports } from '../../db/schema.js'

export const Route = createFileRoute('/api/report')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { messageType, messageId, reason } = await request.json()
        if (!messageType || !messageId || !reason?.trim()) return new Response('Bad request', { status: 400 })
        const [report] = await db
          .insert(reports)
          .values({ reporterId: user.id, messageType, messageId, reason: reason.trim() })
          .returning()
        return Response.json(report, { status: 201 })
      },
    },
  },
})
