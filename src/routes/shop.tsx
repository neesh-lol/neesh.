import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import { ShoppingBag, Sparkles, Palette, BadgeCheck, Crown, CheckCircle, ExternalLink } from 'lucide-react'

export const Route = createFileRoute('/shop')({
  component: ShopPage,
})

type ShopItem = {
  id: string
  name: string
  category: string
  description: string | null
  price_cents: number
  preview_gradient: string | null
  stripe_url: string | null
  active: boolean | null
}

type Purchase = {
  item_id: string
}

const FALLBACK_ITEMS: ShopItem[] = [
  {
    id: 'midnight_pack',
    name: 'Midnight Theme Pack',
    category: 'themes',
    description: 'Dark glass profile theme with premium effects.',
    price_cents: 499,
    preview_gradient: 'linear-gradient(135deg,#09090b,#27272a,#52525b)',
    stripe_url: 'https://buy.stripe.com/fZu5kCbiF7jg8VIaxFdnW01',
    active: true,
  },
  {
    id: 'cyber_pack',
    name: 'Cyber Theme Pack',
    category: 'themes',
    description: 'Neon blue hacker-style profile effects.',
    price_cents: 499,
    preview_gradient: 'linear-gradient(135deg,#020617,#06b6d4,#6366f1)',
    stripe_url: 'https://buy.stripe.com/4gMdR8dqNgTQ3BoeNVdnW02',
    active: true,
  },
  {
    id: 'aurora_pack',
    name: 'Aurora Theme Pack',
    category: 'themes',
    description: 'Purple and cyan premium gradient profile style.',
    price_cents: 499,
    preview_gradient: 'linear-gradient(135deg,#7c3aed,#06b6d4,#ec4899)',
    stripe_url: 'https://buy.stripe.com/5kQeVc5YlbzwdbY49hdnW03',
    active: true,
  },
]

const CATEGORIES = [
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'avatar_decorations', label: 'Avatar Decorations', icon: Sparkles },
  { id: 'profile_decorations', label: 'Profile Decorations', icon: BadgeCheck },
  { id: 'name_effects', label: 'Name Effects', icon: Crown },
  { id: 'owned', label: 'Owned', icon: CheckCircle },
]

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function ShopPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [items, setItems] = useState<ShopItem[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [activeCategory, setActiveCategory] = useState('themes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (ready && !user) {
      navigate({ to: '/signin' })
    }
  }, [ready, user, navigate])

  const ownedIds = useMemo(
    () => new Set(purchases.map((purchase) => purchase.item_id)),
    [purchases]
  )

  const visibleItems = useMemo(() => {
    if (activeCategory === 'owned') {
      return items.filter((item) => ownedIds.has(item.id))
    }

    return items.filter((item) => item.category === activeCategory)
  }, [items, ownedIds, activeCategory])

  const loadShop = async () => {
    if (!user) return

    setLoading(true)
    setError('')

    const { data: itemRows, error: itemError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true })

    if (itemError) {
      console.error('Shop items load error:', itemError)
      setError(itemError.message || 'Could not load shop items')
      setItems(FALLBACK_ITEMS)
    } else {
      const loaded = itemRows && itemRows.length > 0 ? itemRows : FALLBACK_ITEMS
      setItems(loaded as ShopItem[])
    }

    const { data: purchaseRows, error: purchaseError } = await supabase
      .from('user_purchases')
      .select('item_id')
      .eq('user_id', user.id)

    if (purchaseError) {
      console.error('Purchases load error:', purchaseError)
      setPurchases([])
    } else {
      setPurchases((purchaseRows ?? []) as Purchase[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadShop()
  }, [user])

  const buyItem = (item: ShopItem) => {
    if (!item.stripe_url) {
      setError('This item is not available yet.')
      return
    }

    const url = new URL(item.stripe_url)
    url.searchParams.set('client_reference_id', `${user.id}:${item.id}`)

    if (user.email) {
      url.searchParams.set('prefilled_email', user.email)
    }

    window.location.href = url.toString()
  }

  if (!ready || !user) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShoppingBag size={16} className="text-purple-400" />
          Shop
        </h1>
        <p className="text-xs text-zinc-500">
          Buy theme packs, profile decorations, avatar effects, and more.
        </p>
      </div>

      <div className="px-5 py-5 border-b border-zinc-900">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="h-40 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,.45),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(6,182,212,.35),transparent_30%),linear-gradient(135deg,#09090b,#18181b)] flex items-end">
            <div className="p-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300 mb-2">
                NEESH. Shop
              </p>
              <h2 className="text-2xl font-black text-white">Theme Packs</h2>
              <p className="text-sm text-zinc-400 mt-1 max-w-xl">
                Customize your profile with premium visual packs. Launch packs are $4.99 each.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-zinc-900 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            const active = activeCategory === category.id

            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white text-zinc-950'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                <Icon size={14} />
                {category.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 px-5 py-5">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={22} className="text-zinc-600" />
            </div>
            <p className="text-sm font-medium text-white mb-1">
              {activeCategory === 'owned' ? 'No owned items yet' : 'Nothing here yet'}
            </p>
            <p className="text-xs text-zinc-500">
              {activeCategory === 'owned'
                ? 'Purchased items will show here after Stripe fulfillment is connected.'
                : 'More cosmetics will be added soon.'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleItems.map((item) => {
              const owned = ownedIds.has(item.id)

              return (
                <div
                  key={item.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors"
                >
                  <div
                    className="h-36"
                    style={{
                      background:
                        item.preview_gradient ||
                        'linear-gradient(135deg,#18181b,#27272a)',
                    }}
                  />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                        <p className="text-xs text-zinc-500 mt-1 capitalize">
                          {item.category.replaceAll('_', ' ')}
                        </p>
                      </div>

                      {owned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle size={11} />
                          Owned
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-white">
                          {formatPrice(item.price_cents)}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-zinc-400 mt-3 min-h-[42px]">
                      {item.description || 'Premium cosmetic item for your profile.'}
                    </p>

                    {owned ? (
                      <button
                        onClick={() => navigate({ to: '/profile' })}
                        className="mt-4 w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                      >
                        Equip in Profile
                      </button>
                    ) : (
                      <button
                        onClick={() => buyItem(item)}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors"
                      >
                        Buy {formatPrice(item.price_cents)}
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      
    </div>
  )
}
