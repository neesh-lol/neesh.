import { db } from '../../db/index.js'
import { userProfiles } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

async function findProfileByMetadataOrEmail(
  metadata: Record<string, string> | undefined,
  customerEmail: string | undefined
) {
  if (metadata?.netlify_id) {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.netlifyId, metadata.netlify_id))
      .limit(1)
    if (profile) return profile
    console.log('[stripe-webhook] No profile found for netlify_id:', metadata.netlify_id)
  }

  if (metadata?.netlifyId) {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.netlifyId, metadata.netlifyId))
      .limit(1)
    if (profile) return profile
  }

  if (customerEmail) {
    console.log('[stripe-webhook] Falling back to email match:', customerEmail)
  }

  return null
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    console.error('[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
    return new Response('Stripe not configured', { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) return new Response('No signature', { status: 400 })

  const timestampMatch = sig.match(/t=(\d+)/)
  const sigMatch = sig.match(/v1=([a-f0-9]+)/)
  if (!timestampMatch || !sigMatch) return new Response('Invalid signature', { status: 400 })

  const timestamp = timestampMatch[1]
  const payload = `${timestamp}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const expectedSig = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (expectedSig !== sigMatch[1]) {
    console.error('[stripe-webhook] Signature verification failed')
    return new Response('Invalid signature', { status: 400 })
  }

  const event = JSON.parse(body)
  console.log('[stripe-webhook] Event received:', event.type, 'id:', event.id)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const metadata = session.metadata
      const customerId = session.customer
      const subscriptionId = session.subscription

      console.log('[stripe-webhook] Checkout completed. metadata:', JSON.stringify(metadata), 'customer:', customerId)

      if (!metadata?.netlify_id) {
        console.error('[stripe-webhook] Missing netlify_id in checkout metadata')
        break
      }

      const profile = await findProfileByMetadataOrEmail(metadata, session.customer_email)
      if (!profile) {
        console.error('[stripe-webhook] No user found for metadata:', JSON.stringify(metadata))
        break
      }

      if (profile.isPremium && profile.stripeSubscriptionId === subscriptionId) {
        console.log('[stripe-webhook] User already has this subscription, skipping duplicate grant')
        break
      }

      try {
        await db
          .update(userProfiles)
          .set({
            isPremium: true,
            premiumSince: profile.isPremium ? profile.premiumSince : new Date(),
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionTier: 'neesh_plus',
            badgeType: 'verified',
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.netlifyId, profile.netlifyId))
        console.log('[stripe-webhook] Successfully upgraded user:', profile.netlifyId, 'username:', profile.username)
      } catch (err) {
        console.error('[stripe-webhook] Failed to update user profile:', err)
      }
      break
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object
      const customerId = subscription.customer

      console.log('[stripe-webhook] Subscription created. customer:', customerId, 'status:', subscription.status)

      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.stripeCustomerId, customerId))
        .limit(1)

      if (!profile) {
        console.log('[stripe-webhook] No profile for customer:', customerId, '(may be handled by checkout.session.completed)')
        break
      }

      if (profile.isFounderOverride) {
        console.log('[stripe-webhook] Skipping founder account:', profile.username)
        break
      }

      const active = subscription.status === 'active' || subscription.status === 'trialing'
      if (active && !profile.isPremium) {
        try {
          await db
            .update(userProfiles)
            .set({
              isPremium: true,
              premiumSince: new Date(),
              stripeSubscriptionId: subscription.id,
              subscriptionTier: 'neesh_plus',
              badgeType: 'verified',
              premiumExpires: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
              updatedAt: new Date(),
            })
            .where(eq(userProfiles.netlifyId, profile.netlifyId))
          console.log('[stripe-webhook] Activated subscription for user:', profile.netlifyId)
        } catch (err) {
          console.error('[stripe-webhook] Failed to activate subscription:', err)
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const customerId = subscription.customer

      console.log('[stripe-webhook] Subscription updated. customer:', customerId, 'status:', subscription.status)

      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.stripeCustomerId, customerId))
        .limit(1)

      if (!profile) {
        console.error('[stripe-webhook] No profile found for customer:', customerId)
        break
      }

      if (profile.isFounderOverride) {
        console.log('[stripe-webhook] Skipping founder account:', profile.username)
        break
      }

      const active = subscription.status === 'active' || subscription.status === 'trialing'
      try {
        await db
          .update(userProfiles)
          .set({
            isPremium: active,
            premiumExpires: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : null,
            subscriptionTier: active ? 'neesh_plus' : 'free',
            badgeType: active ? 'verified' : 'standard',
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.netlifyId, profile.netlifyId))
        console.log('[stripe-webhook] Updated subscription status for user:', profile.netlifyId, 'active:', active)
      } catch (err) {
        console.error('[stripe-webhook] Failed to update subscription:', err)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = subscription.customer

      console.log('[stripe-webhook] Subscription deleted. customer:', customerId)

      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.stripeCustomerId, customerId))
        .limit(1)

      if (!profile) {
        console.error('[stripe-webhook] No profile found for customer:', customerId)
        break
      }

      if (profile.isFounderOverride) {
        console.log('[stripe-webhook] Skipping founder account:', profile.username)
        break
      }

      try {
        await db
          .update(userProfiles)
          .set({
            isPremium: false,
            stripeSubscriptionId: null,
            premiumExpires: null,
            subscriptionTier: 'free',
            badgeType: 'standard',
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.netlifyId, profile.netlifyId))
        console.log('[stripe-webhook] Cancelled subscription for user:', profile.netlifyId)
      } catch (err) {
        console.error('[stripe-webhook] Failed to cancel subscription:', err)
      }
      break
    }

    default:
      console.log('[stripe-webhook] Unhandled event type:', event.type)
  }

  return Response.json({ received: true })
}
