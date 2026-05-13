import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link to="/" className="text-xs text-zinc-600 hover:text-white transition-colors">&larr; Back to neesh</Link>
          <h1 className="text-2xl font-bold text-white mt-4">Privacy Policy</h1>
          <p className="text-xs text-zinc-600 mt-1">Last updated: May 11, 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">1. Data We Collect</h2>
            <p><strong className="text-white">Account information:</strong> When you sign up, we collect your email address, display name, and any profile information you choose to provide (bio, avatar, interests).</p>
            <p><strong className="text-white">Usage data:</strong> We collect information about how you use neesh, including messages sent, rooms joined, and feature interactions, to improve the service and calculate activity scores.</p>
            <p><strong className="text-white">Device data:</strong> We may collect browser type, operating system, and IP address for security and analytics purposes.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">2. Payment Processing</h2>
            <p>All payment processing for neesh.+ subscriptions is handled by <strong className="text-white">Stripe</strong>. We do not store your credit card number, CVV, or full payment details on our servers. Stripe processes your payment information in accordance with PCI DSS standards. Please review <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline text-white hover:text-zinc-300">Stripe's Privacy Policy</a> for details on how they handle your payment data.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">3. Cookies</h2>
            <p>neesh uses essential cookies for authentication (session management via Netlify Identity). We do not use third-party advertising cookies. Authentication cookies are necessary for the service to function and cannot be disabled while logged in.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">4. How We Use Your Data</h2>
            <p>We use your data to: provide and maintain the neesh service; process subscriptions; personalize your experience; calculate leaderboard scores; send service-related communications; and prevent abuse.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">5. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with: Stripe (payment processing); Netlify (hosting and authentication); and when required by law.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">6. Account Deletion</h2>
            <p>You may request deletion of your account and associated data by contacting us at <span className="text-white">[your-email@example.com — update this placeholder]</span>. Upon deletion, your profile, messages, and personal data will be permanently removed. Active subscriptions must be canceled before account deletion.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">7. Third-Party Services</h2>
            <p>neesh integrates with the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li><strong className="text-white">Netlify</strong> — Hosting, serverless functions, and identity/authentication</li>
              <li><strong className="text-white">Stripe</strong> — Payment processing for neesh.+ subscriptions</li>
            </ul>
            <p>Each service has its own privacy policy governing their handling of your data.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">8. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion of your data; object to or restrict processing; and data portability. To exercise these rights, contact us at <span className="text-white">[your-email@example.com — update this placeholder]</span>.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">9. Data Security</h2>
            <p>We implement reasonable security measures to protect your data, including encrypted connections (HTTPS), secure authentication, and access controls. However, no method of transmission over the internet is 100% secure.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify users of material changes. Continued use of neesh after changes are posted constitutes acceptance.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">11. Contact</h2>
            <p>For privacy-related inquiries, contact us at <span className="text-white">[your-email@example.com — update this placeholder]</span>.</p>
          </section>
        </div>

        <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link to="/community-guidelines" className="hover:text-white transition-colors">Community Guidelines</Link>
          <Link to="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
        </div>
      </div>
    </div>
  )
}
