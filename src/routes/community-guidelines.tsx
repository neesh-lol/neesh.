import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/community-guidelines')({
  component: CommunityGuidelinesPage,
})

function CommunityGuidelinesPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">
        <div>
          <Link to="/" className="text-xs text-zinc-600 hover:text-white transition-colors">&larr; Back to neesh</Link>
          <h1 className="text-2xl font-bold text-white mt-4">Community Guidelines</h1>
          <p className="text-xs text-zinc-600 mt-1">Last updated: May 11, 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          <p>neesh is built around shared interests and genuine connection. These guidelines help keep the community welcoming for everyone.</p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Be Respectful</h2>
            <p>Treat everyone with respect. Disagreements are fine — personal attacks, harassment, bullying, and hate speech are not. No discrimination based on race, ethnicity, gender, sexual orientation, religion, disability, or any other characteristic.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Keep It Safe</h2>
            <p>Do not share personal information about others without their consent. Do not post content that is illegal, sexually explicit, excessively violent, or designed to shock. Do not threaten or intimidate other users.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">No Spam or Manipulation</h2>
            <p>Do not send unsolicited promotions, advertisements, or repetitive messages. Do not use bots, scripts, or automated tools to manipulate the platform. Do not artificially inflate scores, streaks, or leaderboard rankings.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Respect Intellectual Property</h2>
            <p>Only share content you have the right to share. Do not post copyrighted material without permission.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Use Rooms Appropriately</h2>
            <p>Stay on topic in interest-specific chat rooms. Use the community channel for general conversation. Premium chat is a privilege — the same rules apply there.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Report, Don't Retaliate</h2>
            <p>If you encounter content or behavior that violates these guidelines, use the report feature. Do not engage in retaliatory behavior.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Enforcement</h2>
            <p>Violations may result in content removal, temporary suspension, or permanent account termination at our discretion. Repeated or severe violations will result in immediate action. We reserve the right to determine what constitutes a violation of these guidelines.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-white">Contact</h2>
            <p>To report a concern or appeal a moderation decision, contact us at <span className="text-white">[your-email@example.com — update this placeholder]</span>.</p>
          </section>
        </div>

        <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
          <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link to="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
        </div>
      </div>
    </div>
  )
}
