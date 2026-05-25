import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/refund-policy')({
  component: RefundPolicyPage,
})

function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link to="/" className="text-xs text-zinc-600 hover:text-white transition-colors">
            &larr; Back to neesh
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4">Refund Policy</h1>
          <p className="text-xs text-zinc-600 mt-1">Last updated: May 25, 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Overview</h2>
            <p>
              This Refund Policy applies to purchases made through neesh, including NEESH.+ subscriptions,
              theme packs, avatar decorations, profile customizations, and other digital goods.
            </p>
            <p>
              By purchasing any paid product or subscription through neesh, you agree to this Refund Policy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Digital Products</h2>
            <p>
              All purchases of digital products are <strong className="text-white">final and non-refundable</strong>.
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Theme packs</li>
              <li>Avatar decorations</li>
              <li>Profile decorations</li>
              <li>Name effects</li>
              <li>Cosmetic items</li>
              <li>Virtual goods</li>
              <li>Unlockable content</li>
            </ul>
            <p>
              Once a digital item has been delivered, unlocked, granted to an account, or otherwise made
              available for use, the purchase is non-refundable except where required by applicable law.
            </p>
            <p>
              Accidental purchases, change of mind, failure to use the item, dissatisfaction with cosmetic
              appearance, or account inactivity do not qualify for a refund.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">NEESH.+ Subscriptions</h2>
            <p>
              NEESH.+ subscriptions are billed in advance on a recurring basis and are{' '}
              <strong className="text-white">non-refundable</strong>.
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>You are charged immediately for the current billing period.</li>
              <li>No refunds or credits are provided for partially used billing periods.</li>
              <li>No refunds are provided for unused features or inactivity.</li>
              <li>Cancellation does not entitle you to a refund for the current billing period.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Cancellation</h2>
            <p>
              You may cancel your NEESH.+ subscription at any time through the Stripe Customer Portal or
              subscription tools provided in your account.
            </p>
            <p>After cancellation:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Future renewal charges will stop.</li>
              <li>Existing premium benefits remain active until the current paid period expires.</li>
              <li>Your account returns to the free tier after expiration.</li>
              <li>No partial or prorated refunds will be issued.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Duplicate Charges and Billing Errors</h2>
            <p>
              If you believe you were charged multiple times for the same purchase, experienced a billing
              error, or encountered a technical issue during payment processing, please contact us before
              initiating a chargeback or dispute.
            </p>
            <p>
              We may investigate billing issues and, where appropriate, correct verified payment errors.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Chargebacks and Payment Disputes</h2>
            <p>
              If a chargeback or payment dispute is filed with a bank, card issuer, or payment provider,
              access to purchased digital products, subscriptions, premium benefits, or account features
              may be suspended while the dispute is under review.
            </p>
            <p>
              Fraudulent or abusive chargeback activity may result in account restrictions or termination.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Fraud Prevention</h2>
            <p>
              We reserve the right to refuse, revoke, suspend, or reverse access to purchased content if
              we reasonably believe a transaction was fraudulent, unauthorized, reversed by a payment
              provider, or obtained through abuse, exploitation, or violation of our Terms of Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Refund Exceptions</h2>
            <p>
              Refunds are generally not provided. However, we reserve the right, at our sole discretion,
              to issue a refund, account credit, replacement item, or other resolution in exceptional
              circumstances.
            </p>
            <p>
              The existence of a previous refund does not create any obligation to provide future refunds.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Service Availability</h2>
            <p>
              Temporary outages, maintenance, software bugs, feature changes, updates, or modifications
              to the Service do not create an entitlement to a refund unless otherwise required by law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p>
              For billing questions, payment issues, or refund inquiries, contact us at{' '}
              <a href="mailto:neesh.lol.help@gmail.com" className="text-white underline hover:text-zinc-300">
                neesh.lol.help@gmail.com
              </a>
              .
            </p>
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
