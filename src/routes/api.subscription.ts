import { createFileRoute } from '@tanstack/react-router'
import { getUser } from '@netlify/identity'
import { db } from '../../db/index.js'
import { userProfiles } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { checkPremiumStatus } from '../lib/premium.js'

const NEESH_PLUS_PRICE_ID = 'price_1TVrOoB2pv2IqeYpkvG6tX2W'

export const Route = createFileRoute('/api/subscription')({
  server: {
    handlers: {
      GET: async () => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })

        const { isPremium, isFounder } = await checkPremiumStatus(user.id)

        const [profile] = await db
          .select({
            premiumSince: userProfiles.premiumSince,
            premiumExpires: userProfiles.premiumExpires,
            stripeSubscriptionId: userProfiles.stripeSubscriptionId,
            subscriptionTier: userProfiles.subscriptionTier,
          })
          .from(userProfiles)
          .where(eq(userProfiles.netlifyId, user.id))
          .limit(1)

        return Response.json({
          isPremium,
          isFounder,
          premiumSince: profile?.premiumSince ?? null,
          premiumExpires: isFounder ? null : (profile?.premiumExpires ?? null),
          hasStripeSubscription: !!profile?.stripeSubscriptionId,
          subscriptionTier: isPremium ? (profile?.subscriptionTier ?? 'neesh_plus') : null,
        })
      },
      POST: async ({ request }) => {
        const user = await getUser()
        if (!user) return new Response('Unauthorized', { status: 401 })
        const { action } = await request.json()

        if (action === 'create-checkout') {
          const stripeKey = typeof process !== 'undefined' ? process.env.STRIPE_SECRET_KEY : undefined
          if (!stripeKey) {
            return Response.json({ error: 'Stripe not configured' }, { status: 503 })
          }

          const [profile] = await db
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.netlifyId, user.id))
            .limit(1)

          const { isFounder } = await checkPremiumStatus(user.id)
          if (isFounder) {
            return Response.json({ error: 'Founder accounts have permanent premium' }, { status: 400 })
          }

          let customerId = profile?.stripeCustomerId
          if (!customerId) {
            const customerRes = await fetch('https://api.stripe.com/v1/customers', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${stripeKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                email: user.email || '',
                'metadata[netlify_id]': user.id,
              }),
            })
            const customer = await customerRes.json()
            customerId = customer.id
            await db
              .update(userProfiles)
              .set({ stripeCustomerId: customerId, updatedAt: new Date() })
              .where(eq(userProfiles.netlifyId, user.id))
          }

          const priceId = (typeof process !== 'undefined' ? process.env.STRIPE_PRICE_ID : undefined) || NEESH_PLUS_PRICE_ID

          const origin = typeof process !== 'undefined' ? process.env.URL : ''
          const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              'customer': customerId!,
              'line_items[0][price]': priceId,
              'line_items[0][quantity]': '1',
              'mode': 'subscription',
              'success_url': `${origin}/premium-success`,
              'cancel_url': `${origin}/premium-cancel`,
              'metadata[netlify_id]': user.id,
              'metadata[username]': profile?.username || '',
              'metadata[email]': user.email || '',
            }),
          })
          const session = await sessionRes.json()
          return Response.json({ url: session.url })
        }

        if (action === 'create-portal') {
          const stripeKey = typeof process !== 'undefined' ? process.env.STRIPE_SECRET_KEY : undefined
          if (!stripeKey) {
            return Response.json({ error: 'Stripe not configured' }, { status: 503 })
          }

          const [profile] = await db
            .select({ stripeCustomerId: userProfiles.stripeCustomerId })
            .from(userProfiles)
            .where(eq(userProfiles.netlifyId, user.id))
            .limit(1)

          if (!profile?.stripeCustomerId) {
            return Response.json({ error: 'No subscription found' }, { status: 400 })
          }

          const origin = typeof process !== 'undefined' ? process.env.URL : ''
          const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              customer: profile.stripeCustomerId,
              return_url: `${origin}/premium`,
            }),
          })
          const portal = await portalRes.json()
          return Response.json({ url: portal.url })
        }

        return new Response('Invalid action', { status: 400 })
      },
    },
  },
})
