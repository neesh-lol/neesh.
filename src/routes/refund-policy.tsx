import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/refund-policy')({
  component: RefundPolicyPage,
})

function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link to="/" className="text-xs text-zinc-600 hover:text-white transition-colors">&larr; Back to neesh</Link>
          <h1 className="text-2xl font-bold text-white mt-4">Refund Policy</h1>
          <p className="text-xs text-zinc-600 mt-1">Last updated: May 11, 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Subscription Refunds</h2>
            <p>neesh.+ subscriptions are <strong className="text-white">non-refundable</strong>. When you subscribe, you are billed immediately for the current monthly period. No refunds or credits are issued for partial months, unused time, or any reason other than as required by applicable law.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">How to Cancel</h2>
            <p>You may cancel your neesh.+ subscription at any time through the Stripe customer portal, accessible from your <Link to="/settings" className="underline text-white hover:text-zinc-300">account settings</Link> or the <Link to="/premium" className="underline text-white hover:text-zinc-300">premium page</Link>.</p>
            <p>Upon cancellation:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Your premium features remain active until the end of the current billing period</li>
              <li>You will not be charged again after the current period ends</li>
              <li>Your account reverts to the free tier when the period expires</li>
              <li>No partial refund is issued for the remaining days in the billing period</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Billing Disputes</h2>
            <p>If you believe you were charged in error or have a billing concern, contact us at <span className="text-white">[your-email@example.com — update this placeholder]</span> before initiating a dispute with your bank or card issuer. We will work with you to resolve the issue.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Exceptions</h2>
            <p>In rare circumstances, we may issue refunds at our sole discretion. Refund requests should be submitted within 7 days of the charge in question. Contact us with your account email and a description of the issue.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p>For billing inquiries, contact us at <span className="text-white">[your-email@example.com — update this placeholder]</span>.</p>
          </section>
        </div>

        <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link to="/community-guidelines" className="hover:text-white transition-colors">Community Guidelines</Link>
        </div>
      </div>
    </div>
  )
}
