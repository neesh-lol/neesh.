import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { termsAcceptances } from '../../db/schema.js'

export const Route = createFileRoute('/api/terms-consent')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user?.id) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        const body = await request.json()
        const forwarded = request.headers.get('x-forwarded-for')
        const ip = forwarded?.split(',')[0]?.trim() || null
        const ua = request.headers.get('user-agent') || null

        await db.insert(termsAcceptances).values({
          netlifyId: user.id,
          termsAccepted: body.termsAccepted === true,
          subscriptionDisclosureAccepted: body.subscriptionDisclosureAccepted === true,
          ipAddress: ip,
          userAgent: ua,
        })

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
