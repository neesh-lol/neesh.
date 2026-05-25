import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Users, Clock } from 'lucide-react'
import { UserPopup } from '@/components/UserPopup'

export const Route = createFileRoute('/weekly-match')({
  component: WeeklyMatchPage,
})

type Member = {
  user_id: string
  profiles?: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    total_xp: number | null
    current_streak: number | null
    is_premium: boolean | null
    is_founder_override: boolean | null
  } | null
}

type Message = {
  id: string
  group_id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  content: string
  created_at: string
}

type Group = {
  id: string
  created_at: string
  expires_at: string
}

function getDisplayName(member: Member) {
  return member.profiles?.display_name || member.profiles?.username || 'User'
}

function getLevel(totalXp: number) {
  return Math.min(100, Math.floor(totalXp / 1000) + 1)
}

function WeeklyMatchPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [myProfile, setMyProfile] = useState<any>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState<{ userId: string; displayName: string; avatarUrl?: string; x: number; y: number } | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  const loadWeeklyMatch = async () => {
    if (!user) return

    setLoading(true)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    setMyProfile(profile)

    const { data: membership, error: membershipError } = await supabase
      .from('weekly_match_members')
      .select('group_id, weekly_match_groups(id, created_at, expires_at)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      console.error('Weekly match membership error:', membershipError)
    }

    const matchGroup = (membership?.weekly_match_groups as Group | null) ?? null

    if (!matchGroup) {
      setGroup(null)
      setMembers([])
      setMessages([])
      setLoading(false)
      return
    }

    setGroup(matchGroup)

    const { data: memberRows, error: membersError } = await supabase
      .from('weekly_match_members')
      .select('user_id, profiles(id, username, display_name, avatar_url, total_xp, current_streak, is_premium, is_founder_override)')
      .eq('group_id', matchGroup.id)

    if (membersError) {
      console.error('Weekly match members error:', membersError)
    }

    setMembers((memberRows ?? []) as Member[])

    const { data: messageRows, error: messagesError } = await supabase
      .from('weekly_match_messages')
      .select('*')
      .eq('group_id', matchGroup.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Weekly match messages error:', messagesError)
    }

    setMessages((messageRows ?? []) as Message[])
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    loadWeeklyMatch()
  }, [user])

  useEffect(() => {
    if (!group) return

    const channel = supabase
      .channel(`weekly_match_messages_${group.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'weekly_match_messages',
          filter: `group_id=eq.${group.id}`,
        },
        (payload) => {
          const row = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [...prev, row]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!user || !group || !input.trim() || sending) return

    setSending(true)

    const { data, error } = await supabase
      .from('weekly_match_messages')
      .insert({
        group_id: group.id,
        user_id: user.id,
        display_name: myProfile?.display_name ?? user.name ?? user.email ?? 'User',
        avatar_url: myProfile?.avatar_url ?? '',
        content: input.trim(),
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Weekly match send error:', error)
      alert(error.message)
    } else {
      if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data as Message]
        })
      }

      setInput('')
    }

    setSending(false)
  }

  if (!ready || !user) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h1 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            Weekly Match
          </h1>
          <p className="text-xs text-zinc-500">Get matched with people who want to meet new friends.</p>
        </div>

        <div className="flex-1 flex items-center justify-center px-5">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-4">
              <Users size={26} className="text-purple-400" />
            </div>

            <h2 className="text-lg font-semibold text-white mb-2">No weekly match yet</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Your profile switch is ready. Once matches are generated, your group will appear here.
            </p>

            <button
              onClick={() => navigate({ to: '/profile' })}
              className="px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              Check Weekly Match Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  const expiresAt = new Date(group.expires_at)

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          Weekly Match
        </h1>
        <p className="text-xs text-zinc-500 flex items-center gap-1">
          <Clock size={12} />
          Expires {expiresAt.toLocaleDateString()} at {expiresAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>

      <div className="px-5 py-4 border-b border-zinc-800">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Matched with</p>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => {
            const name = getDisplayName(member)
            const totalXp = member.profiles?.total_xp ?? 0
            const level = getLevel(totalXp)

            return (
              <button
                key={member.user_id}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setPopup({
                    userId: member.user_id,
                    displayName: name,
                    avatarUrl: member.profiles?.avatar_url ?? undefined,
                    x: rect.left,
                    y: rect.bottom + 6,
                  })
                }}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors"
              >
                {member.profiles?.avatar_url ? (
                  <img src={member.profiles.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-white">
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xs text-white">{name}</p>
                  <p className="text-[10px] text-zinc-500">Level {level}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center mt-16">No messages yet. Say hi to your weekly match.</p>
        ) : (
          messages.map((message) => {
            const name = message.display_name ?? 'User'
            const avatar = message.avatar_url ?? ''
            const createdAt = new Date(message.created_at).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })

            return (
              <div key={message.id} className="flex items-start gap-3 group">
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setPopup({
                      userId: message.user_id,
                      displayName: name,
                      avatarUrl: avatar || undefined,
                      x: rect.right + 8,
                      y: rect.top,
                    })
                  }}
                  className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-zinc-600 transition-all"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-white font-medium">
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setPopup({
                          userId: message.user_id,
                          displayName: name,
                          avatarUrl: avatar || undefined,
                          x: rect.left,
                          y: rect.bottom + 4,
                        })
                      }}
                      className="text-sm font-medium text-white hover:underline truncate"
                    >
                      {name}
                    </button>

                    <span className="text-[10px] text-zinc-600">{createdAt}</span>
                  </div>

                  <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
                    {message.content}
                  </p>
                </div>
              </div>
            )
          })
        )}

        <div ref={bottomRef} />
      </div>

      {popup && (
        <UserPopup
          userId={popup.userId}
          displayName={popup.displayName}
          avatarUrl={popup.avatarUrl}
          currentUserId={user.id}
          position={{ x: popup.x, y: popup.y }}
          onClose={() => setPopup(null)}
          onViewProfile={(username) => navigate({ to: '/friends', search: { view: username } as any })}
        />
      )}

      <div className="px-5 py-4 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Message your weekly match"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />

          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
