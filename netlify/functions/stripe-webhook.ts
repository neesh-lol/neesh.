import type { Handler } from '@netlify/functions'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
})

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

const VALID_ITEM_IDS = new Set([
  'midnight_pack',
  'cyber_pack',
  'aurora_pack',
])

function getRawBody(event: any) {
  if (event.isBase64Encoded) {
    return Buffer.from(event.body || '', 'base64')
  }

  return Buffer.from(event.body || '', 'utf8')
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    }
  }

  const signature = event.headers['stripe-signature']

  if (!signature) {
    return {
      statusCode: 400,
      body: 'Missing Stripe signature',
    }
  }

  let stripeEvent: Stripe.Event

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      getRawBody(event),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (error: any) {
    console.error('Stripe webhook signature verification failed:', error.message)

    return {
      statusCode: 400,
      body: `Webhook Error: ${error.message}`,
    }
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session

      const paid =
        session.payment_status === 'paid' ||
        session.status === 'complete'

      if (!paid) {
        return {
          statusCode: 200,
          body: 'Session not paid yet',
        }
      }

      const reference = session.client_reference_id || ''

      // Format from shop page:
      // user_uuid:item_id
      const [userId, itemId] = reference.split(':')

      if (!userId || !itemId) {
        console.error('Missing client_reference_id data:', reference)

        return {
          statusCode: 200,
          body: 'Missing user/item reference',
        }
      }

      if (!VALID_ITEM_IDS.has(itemId)) {
        console.error('Invalid shop item id:', itemId)

        return {
          statusCode: 200,
          body: 'Invalid item id',
        }
      }

      const { error: purchaseError } = await supabaseAdmin
        .from('user_purchases')
        .upsert(
          {
            user_id: userId,
            item_id: itemId,
          },
          {
            onConflict: 'user_id,item_id',
          }
        )

      if (purchaseError) {
        console.error('Failed to unlock purchase:', purchaseError)

        return {
          statusCode: 500,
          body: 'Failed to unlock purchase',
        }
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        actor_id: userId,
        type: 'premium',
        title: 'Shop Item Unlocked',
        body: `Your ${itemId.replaceAll('_', ' ')} is now available in your profile.`,
        link: '/profile',
      })

      console.log(`Unlocked ${itemId} for ${userId}`)
    }

    return {
      statusCode: 200,
      body: 'ok',
    }
  } catch (error: any) {
    console.error('Stripe webhook handler failed:', error)

    return {
      statusCode: 500,
      body: error.message || 'Webhook failed',
    }
  }
}
