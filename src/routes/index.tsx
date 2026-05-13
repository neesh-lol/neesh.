import { createFileRoute, Link } from '@tanstack/react-router'
import { MessageSquare, Users, Zap, Shield, Hash, ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

const FEATURES = [
  {
    icon: Hash,
    title: 'Interest Rooms',
    description: 'Join topic-based chat rooms for gaming, music, art, tech, and more.',
  },
  {
    icon: Users,
    title: 'Find Your People',
    description: 'Connect with like-minded individuals who share your passions.',
  },
  {
    icon: MessageSquare,
    title: 'Real Conversations',
    description: 'Direct messages, community chat, and weekly match groups.',
  },
  {
    icon: Zap,
    title: 'Earn & Compete',
    description: 'Gain XP, build streaks, complete challenges, and climb the leaderboard.',
  },
  {
    icon: Shield,
    title: 'Safe Space',
    description: 'Moderation tools, content filters, and community guidelines keep things civil.',
  },
  {
    icon: ArrowRight,
    title: 'Premium Perks',
    description: 'Unlock profile customization, exclusive chat rooms, and more with NEESH.+',
  },
]

function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <img src="/neesh-logo.png" alt="neesh" className="h-8" />
          <div className="flex items-center gap-3">
            <Link
              to="/signin"
              className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2"
            >
              Log In
            </Link>
            <Link
              to="/signup"
              className="text-sm bg-white text-black px-5 py-2 rounded-full font-medium hover:bg-zinc-200 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <section className="flex flex-col items-center justify-center text-center px-6 pt-40 pb-24 md:pt-52 md:pb-32">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-800 text-xs text-zinc-500 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Now in beta
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tight leading-[1.05]">
          find your
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-400 to-zinc-600">
            people.
          </span>
        </h1>
        <p className="text-zinc-500 text-lg md:text-xl max-w-lg mt-8 leading-relaxed">
          An interest-based community where real connections happen. Join rooms, chat with like-minded people, and belong.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-12">
          <Link
            to="/signup"
            className="bg-white text-black px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            Get Started <ArrowRight size={16} />
          </Link>
          <Link
            to="/signin"
            className="border border-zinc-800 text-zinc-300 px-8 py-3.5 rounded-full font-semibold text-sm hover:border-zinc-600 hover:text-white transition-all"
          >
            Log In
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20 md:py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything you need to connect.
          </h2>
          <p className="text-zinc-500 mt-4 max-w-md mx-auto">
            Built for meaningful interactions, not endless scrolling.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 hover:border-zinc-700 transition-colors group"
            >
              <feature.icon
                size={22}
                className="text-zinc-600 group-hover:text-white transition-colors mb-4"
              />
              <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Ready to find your people?
          </h2>
          <p className="text-zinc-500 mt-5 max-w-md mx-auto text-lg">
            Create your profile in seconds and start connecting with people who get you.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-white text-black px-10 py-4 rounded-full font-semibold text-sm hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98] mt-10"
          >
            Create Account <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-900 bg-black">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/neesh-logo.png" alt="neesh" className="h-6 opacity-40" />
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/terms" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Terms</Link>
            <Link to="/privacy" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link to="/refund-policy" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Refund Policy</Link>
            <Link to="/community-guidelines" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Guidelines</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
