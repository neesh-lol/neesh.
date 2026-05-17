import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { Send, Crown, Lock } from 'lucide-react'
import { UserPopup } from '@/components/UserPopup'
import { ChatMessage, ChatMessageData, TypingIndicator, ReplyPreview } from '@/components/ChatMessage'
import {
  containsToxicContent,
  checkSpamCooldown,
  markMessageSent,
  getMutedUsers,
  toggleMuteUser,
} from '@/lib/chat-utils'

export const Route = createFileRoute('/premium-chat')({
  component: PremiumChatPage,
})

type DbMessage = {
  id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  content: string
  reply_to_id: string | null
  created_at: string
}

type ReactionMap = Record<string, Array<{ emoji: string; userId: string; displayName: string }>>

function toChatMessage(row: DbMessage): ChatMessageData {
  return {
    id: row.id as any,
    userId: row.user_id,
    displayName: row.display_name ?? 'User',
    avatarUrl: row.avatar_url ?? '',
    content: row.content,
    replyToId: row.reply_to_id as any,
    createdAt: row.created_at,
  } as ChatMessageData
}

function PremiumChatPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessageData | null>(null)
  const [typingNames] = useState<string[]>([])
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())
  const [blockedUsers] = useState<Set<string>>(new Set())
  const [cooldownMsg, setCooldownMsg] = useState('')
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [popup, setPopup] = useState<{ userId: string; displayName: string; avatarUrl?: string; x: number; y: number } | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    setMutedUsers(getMutedUsers())
  }, [])

  const loadReactions = async () => {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('*')
      .eq('message_type', 'premium')

    if (error) {
      console.error('Premium reaction load error:', error)
      return
    }

    const grouped: ReactionMap = {}

    for (const r of data ?? []) {
      const key = String(r.message_id)
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({
        emoji: r.emoji,
        userId: r.user_id,
        displayName: r.display_name ?? 'User',
      })
    }

    setReactions(grouped)
  }

  useEffect(() => {
    if (!user) return

    async function loadProfileAndAccess() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      setMyProfile(data)

      const isFounder = data?.username === 'ceo' || data?.is_founder_override === true
      const premium = isFounder || data?.is_premium === true

      setIsOwner(isFounder)
      setIsPremium(premium)
    }

    loadProfileAndAccess().catch(() => setIsPremium(false))
  }, [user])

  const awardXp = async () => {
    if (!user) return

    const currentXp = myProfile?.total_xp ?? 0
    const currentMessages = myProfile?.message_count ?? 0

    const { data, error } = await supabase
      .from('profiles')
      .update({
        total_xp: currentXp + 10,
        message_count: currentMessages + 1,
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('XP update error:', error)
      setCooldownMsg(`XP update failed: ${error.message}`)
      setTimeout(() => setCooldownMsg(''), 3000)
      return
    }

    if (data) setMyProfile(data)
  }

  useEffect(() => {
    if (!user || isPremium !== true) return

    async function loadMessages() {
      const { data, error } = await supabase
        .from('premium_messages')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Premium messages load error:', error)
        return
      }

      setMessages((data ?? []).map(toChatMessage))
      await loadReactions()
    }

    loadMessages()

    const channel = supabase
      .channel('premium_messages_live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'premium_messages',
        },
        (payload) => {
          setMessages((prev) => {
            const msg = toChatMessage(payload.new as DbMessage)
            if (prev.some((m) => String(m.id) === String(msg.id))) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, isPremium])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!user || !input.trim() || sending || isPremium !== true) return

    if (containsToxicContent(input)) {
      setCooldownMsg('Message contains inappropriate content')
      setTimeout(() => setCooldownMsg(''), 3000)
      return
    }

    const spam = checkSpamCooldown()
    if (!spam.allowed) {
      setCooldownMsg(`Slow down! Wait ${Math.ceil(spam.remainingMs / 1000)}s`)
      setTimeout(() => setCooldownMsg(''), 2000)
      return
    }

    setSending(true)

    const { data, error } = await supabase
      .from('premium_messages')
      .insert({
        user_id: user.id,
        display_name: myProfile?.display_name ?? user.name ?? user.email ?? 'User',
        avatar_url: myProfile?.avatar_url ?? '',
        content: input.trim(),
        reply_to_id: replyTo?.id ? String(replyTo.id) : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Premium message send error:', error)
      setCooldownMsg(error.message || 'Message failed to send')
      setTimeout(() => setCooldownMsg(''), 3000)
    } else if (data) {
      const msg = toChatMessage(data as DbMessage)

      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(msg.id))) return prev
        return [...prev, msg]
      })

      setInput('')
      setReplyTo(null)
      markMessageSent()
      await awardXp()
    }

    setSending(false)
  }

  const handleReact = async (messageId: number, emoji: string) => {
    if (!user) return

    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_type', 'premium')
      .eq('message_id', String(messageId))
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existing.id)
    } else {
      await supabase
        .from('message_reactions')
        .insert({
          message_type: 'premium',
          message_id: String(messageId),
          user_id: user.id,
          display_name: myProfile?.display_name ?? user.name ?? user.email ?? 'User',
          emoji,
        })
    }

    await loadReactions()
  }

 const handleReport = async (msg: ChatMessageData) => {
  if (!user) return

  const reason = prompt('Why are you reporting this message?')
  if (reason === null) return

  const { error } = await supabase
    .from('message_reports')
    .insert({
      reporter_id: user.id,
      reported_user_id: msg.userId,
      message_type: 'premium',
      message_id: String(msg.id),
      reason: reason.trim() || 'No reason provided',
      message_content: msg.content,
    })

  if (error) {
    console.error('Report message error:', error)
    alert('Failed to submit report.')
    return
  }

  alert('Report submitted. Thank you.')
}

  const handleMute = (userId: string) => {
    const nowMuted = toggleMuteUser(userId)
    setMutedUsers(getMutedUsers())
    alert(nowMuted ? 'User muted' : 'User unmuted')
  }

  const handleBlock = async () => {
    alert('Blocking is being rebuilt for Supabase.')
  }

  const handleDelete = async (msg: ChatMessageData) => {
    if (!user) return
    if (!confirm('Delete this message?')) return

    const isOwnMsg = msg.userId === user.id
    if (!isOwnMsg && !isOwner) return

    const { error } = await supabase
      .from('premium_messages')
      .delete()
      .eq('id', String(msg.id))

    if (error) {
      console.error('Delete premium message error:', error)
      return
    }

    setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)))
  }

  if (!ready || !user) return null

  if (isPremium === null) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 px-5">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Lock size={24} className="text-zinc-600" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">NEESH.+ Members Only</h2>
        <p className="text-sm text-zinc-500 mb-4 text-center max-w-xs">
          This chat is exclusive to NEESH.+ subscribers. Upgrade to join the conversation.
        </p>
        <button
          onClick={() => navigate({ to: '/premium' })}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-950 font-medium rounded-xl text-sm hover:bg-zinc-200 transition-colors"
        >
          <Crown size={15} />
          Get NEESH.+
        </button>
      </div>
    )
  }

  const visibleMessages = messages.filter((m) => !blockedUsers.has(m.userId))

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white flex items-center gap-2">
          <Crown size={14} className="text-yellow-400" />
          NEESH.+ Members
        </h1>
        <p className="text-xs text-zinc-500">Exclusive premium community</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
        {visibleMessages.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-16">
            Welcome to the NEESH.+ lounge. Start the conversation!
          </p>
        )}

        {visibleMessages.map((msg, i) => {
          const prev = visibleMessages[i - 1]
          const grouped = prev?.userId === msg.userId && !msg.replyToId
          const replyTarget = msg.replyToId ? messages.find((m) => String(m.id) === String(msg.replyToId)) ?? null : null

          return (
            <ChatMessage
              key={String(msg.id)}
              msg={msg}
              grouped={grouped}
              currentUserId={user.id}
              messageType="community"
              reactions={reactions[String(msg.id)] ?? []}
              replyTarget={replyTarget}
              isMuted={mutedUsers.has(msg.userId)}
              isFounder={myProfile?.username === 'ceo' && msg.userId === user.id}
              isPremiumUser
              onAvatarClick={(e, m) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setPopup({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl || undefined, x: rect.right + 8, y: rect.top })
              }}
              onNameClick={(e, m) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setPopup({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl || undefined, x: rect.left, y: rect.bottom + 4 })
              }}
              onReply={(m) => { setReplyTo(m); inputRef.current?.focus() }}
              onReact={handleReact}
              onReport={handleReport}
              onMute={handleMute}
              onBlock={handleBlock}
              onDelete={handleDelete}
              isDelivered
              isAdmin={isOwner}
            />
          )
        })}

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

      <TypingIndicator names={typingNames} />

      {replyTo && <ReplyPreview msg={replyTo} onCancel={() => setReplyTo(null)} />}

      <div className="px-5 py-4 border-t border-zinc-800">
        {cooldownMsg && (
          <p className="text-xs text-red-400 mb-2 msg-enter">{cooldownMsg}</p>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={replyTo ? `Reply to ${replyTo.displayName}…` : 'Message NEESH.+ members'}
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
