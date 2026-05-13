import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
})

function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link to="/" className="text-xs text-zinc-600 hover:text-white transition-colors">&larr; Back to neesh</Link>
          <h1 className="text-2xl font-bold text-white mt-4">Terms of Service</h1>
          <p className="text-xs text-zinc-600 mt-1">Last updated: May 11, 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Eligibility</h2>
            <p>You must be at least 13 years of age to use neesh. By creating an account, you represent that you meet this requirement and that all information you provide is accurate. If you are under 18, you must have the consent of a parent or legal guardian.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. Account</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately if you suspect unauthorized access.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. Subscription Billing</h2>
            <p>neesh.+ is a paid subscription service billed at $4.99 per month. Payment is processed securely through Stripe. By subscribing, you authorize recurring monthly charges to your payment method.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">4. Auto-Renewal</h2>
            <p>Your neesh.+ subscription automatically renews each month on the same date you originally subscribed. You will be charged the then-current subscription price at each renewal unless you cancel before the renewal date.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">5. Cancellation</h2>
            <p>You may cancel your subscription at any time through the Stripe customer portal. Cancellation takes effect at the end of the current billing period — you will retain access to premium features until then. No partial refunds are issued for unused time.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">6. Acceptable Use</h2>
            <p>You agree not to use neesh to: post illegal, harmful, or harassing content; impersonate others; distribute spam or malware; attempt to exploit or disrupt the service; or violate the rights of other users. See our <Link to="/community-guidelines" className="underline text-white hover:text-zinc-300">Community Guidelines</Link> for detailed standards.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">7. Account Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these Terms or our Community Guidelines, at our sole discretion, with or without notice. You may delete your account at any time through your account settings.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">8. User-Generated Content</h2>
            <p>You retain ownership of content you post on neesh. By posting, you grant us a non-exclusive, worldwide, royalty-free license to display and distribute your content within the service. We are not responsible for user-generated content and do not endorse any opinions expressed by users.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">9. Limitation of Liability</h2>
            <p>neesh is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service. Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">10. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Continued use of neesh after changes are posted constitutes acceptance of the updated Terms. We will make reasonable efforts to notify users of material changes.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">11. Governing Law</h2>
            <p>These Terms are governed by the laws of the United States. Any disputes shall be resolved in the courts of [Your State/Jurisdiction — update this placeholder].</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">12. Contact</h2>
            <p>Questions about these Terms? Contact us at <span className="text-white">[your-email@example.com — update this placeholder]</span>.</p>
          </section>
        </div>

        <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link to="/community-guidelines" className="hover:text-white transition-colors">Community Guidelines</Link>
          <Link to="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
        </div>
      </div>
    </div>
  )
}
