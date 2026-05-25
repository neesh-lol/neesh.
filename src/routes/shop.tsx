import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/shop')({
  component: ShopPage,
})

function ShopPage() {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    const { data } = await supabase
      .from('shop_items')
      .select('*')
      .eq('active', true)

    setItems(data ?? [])
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Shop</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
          >
            <div
              className="h-32"
              style={{
                background: item.preview_gradient,
              }}
            />

            <div className="p-4">
              <h2 className="font-semibold text-lg">
                {item.name}
              </h2>

              <p className="text-zinc-400 text-sm mt-2">
                {item.description}
              </p>

              <button
                onClick={() => {
                  window.location.href = item.stripe_url
                }}
                className="mt-4 w-full bg-white text-black py-2 rounded-xl font-medium"
              >
                Buy • ${(item.price_cents / 100).toFixed(2)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
