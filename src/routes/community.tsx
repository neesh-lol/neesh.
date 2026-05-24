import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { UserPopup } from '@/components/UserPopup'
import { ChatMessage, ChatMessageData, TypingIndicator, ReplyPreview, PresenceInfo } from '@/components/ChatMessage'
import {
  containsToxicContent,
  checkSpamCooldown,
  markMessageSent,
  getMutedUsers,
  toggleMuteUser,
} from '@/lib/chat-utils'

export const Route = createFileRoute('/community')({
  component: CommunityPage,
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

function CommunityPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessageData | null>(null)
  const [typingNames, setTypingNames] = useState<string[]>([])
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())
  const [blockedUsers] = useState<Set<string>>(new Set())
  const [cooldownMsg, setCooldownMsg] = useState('')
  const [popup, setPopup] = useState<{ userId: string; displayName: string; avatarUrl?: string; x: number; y: number } | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [profileMap, setProfileMap] = useState<Record<string, any>>({})
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceInfo>>({})

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    setMutedUsers(getMutedUsers())
  }, [])

  const loadSenderProfiles = async (messageRows: DbMessage[]) => {
    const userIds = Array.from(new Set(messageRows.map((m) => m.user_id)))

    if (userIds.length === 0) return

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, is_premium, is_founder_override')
      .in('id', userIds)

    if (error) {
      console.error('Sender profile load error:', error)
      return
    }

    const mapped: Record<string, any> = {}

    for (const profile of data ?? []) {
      mapped[profile.id] = profile
    }

    setProfileMap((prev) => ({
      ...prev,
      ...mapped,
    }))
  }

  const loadPresence = async (userIds: string[]) => {
    const cleanIds = Array.from(new Set(userIds)).filter(Boolean)

    if (cleanIds.length === 0) return

    const { data, error } = await supabase
      .from('user_presence')
      .select('user_id,status,last_seen,updated_at')
      .in('user_id', cleanIds)

    if (error) {
      console.error('Community presence load error:', error)
      return
    }

    const mapped: Record<string, PresenceInfo> = {}

    for (const row of data ?? []) {
      mapped[row.user_id] = {
        status: row.status ?? 'offline',
        lastSeen: row.last_seen ?? row.updated_at ?? null,
      }
    }

    setPresenceMap((prev) => ({
      ...prev,
      ...mapped,
    }))
  }

  const loadReactions = async () => {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('*')
      .eq('message_type', 'community')

    if (error) {
      console.error('Reaction load error:', error)
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

  const sendTypingSignal = async () => {
    if (!user) return

    const { error } = await supabase
      .from('chat_typing')
      .upsert({
        chat_type: 'community',
        room_id: 'global',
        typer_id: user.id,
        receiver_id: null,
        display_name: myProfile?.display_name ?? user.name ?? user.email ?? 'User',
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Community typing signal error:', error)
    }
  }

  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Profile load error:', error)
        return
      }

      setMyProfile(data)

      if (data?.username === 'ceo' || data?.is_founder_override === true) {
        setIsOwner(true)
      }
    }

    loadProfile()
  }, [user])

  useEffect(() => {
    if (!user) return

    async function loadMessages() {
      const { data, error } = await supabase
        .from('community_messages')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Community messages load error:', error)
        return
      }

      const rows = data ?? []
      const userIds = Array.from(new Set(rows.map((m: DbMessage) => m.user_id)))

      setMessages(rows.map(toChatMessage))
      await loadSenderProfiles(rows)
      await loadPresence(userIds)
      await loadReactions()
    }

    loadMessages()

    const channel = supabase
      .channel('community_messages_live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
        },
        (payload) => {
          setMessages((prev) => {
            const row = payload.new as DbMessage
            const msg = toChatMessage(row)

            loadSenderProfiles([row])
            loadPresence([row.user_id])

            if (prev.some((m) => String(m.id) === String(msg.id))) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const presenceChannel = supabase
      .channel(`community_presence_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload: any) => {
          const row = payload.new
          if (!row?.user_id) return

          setPresenceMap((prev) => ({
            ...prev,
            [row.user_id]: {
              status: row.status ?? 'offline',
              lastSeen: row.last_seen ?? row.updated_at ?? null,
            },
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const typingChannel = supabase
      .channel(`chat_typing_community_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_typing',
        },
        (payload: any) => {
          const row = payload.new
          if (!row) return

          const isCorrectChat = row.chat_type === 'community' && row.room_id === 'global'
          const isNotMe = row.typer_id !== user.id

          if (!isCorrectChat || !isNotMe) return

          const updatedAt = new Date(row.updated_at).getTime()
          const isFresh = Date.now() - updatedAt < 5000

          if (!isFresh) return

          setTypingNames([row.display_name ?? 'Someone'])

          if (typingClearRef.current) {
            clearTimeout(typingClearRef.current)
          }

          typingClearRef.current = setTimeout(() => {
            setTypingNames([])
          }, 3000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(typingChannel)
      setTypingNames([])

      if (typingClearRef.current) {
        clearTimeout(typingClearRef.current)
      }
    }
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingNames])

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)

    if (!value.trim()) return
    await sendTypingSignal()
  }

  const awardBadge = async (badgeId: string) => {
    if (!user) return

    const { error } = await supabase
      .from('user_badges')
      .upsert({
        user_id: user.id,
        badge_id: badgeId,
      })

    if (error) {
      console.error(`Badge award failed for ${badgeId}:`, error)
    }
  }

  const awardMessageBadges = async (messageCount: number) => {
    if (messageCount >= 1) {
      await awardBadge('first_message')
    }

    if (messageCount >= 100) {
      await awardBadge('hundred_messages')
    }

    if (messageCount >= 1000) {
      await awardBadge('thousand_messages')
    }

    if (messageCount >= 10000) {
      await awardBadge('ten_thousand_messages')
    }
  }

  const awardXp = async () => {
    if (!user) return

    const currentXp = myProfile?.total_xp ?? 0
    const currentMessages = myProfile?.message_count ?? 0
    const newMessageCount = currentMessages + 1

    const { data, error } = await supabase
      .from('profiles')
      .update({
        total_xp: currentXp + 10,
        message_count: newMessageCount,
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

    await awardMessageBadges(newMessageCount)

    if (data) setMyProfile(data)
  }

  const send = async () => {
    if (!user || !input.trim() || sending) return

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
      .from('community_messages')
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
      console.error('Community message send error:', error)
      setCooldownMsg(error.message || 'Message failed to send')
      setTimeout(() => setCooldownMsg(''), 3000)
    } else if (data) {
      const row = data as DbMessage
      const msg = toChatMessage(row)

      await loadSenderProfiles([row])
      await loadPresence([row.user_id])

      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(msg.id))) return prev
        return [...prev, msg]
      })

      setInput('')
      setTypingNames([])
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
      .eq('message_type', 'community')
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
          message_type: 'community',
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
        message_type: 'community',
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

  const handleBlock = async (userId: string) => {
    if (!user) return

    if (userId === user.id) {
      alert('You cannot block yourself.')
      return
    }

    const { error } = await supabase
      .from('user_blocks')
      .upsert({
        blocker_id: user.id,
        blocked_id: userId,
      })

    if (error) {
      console.error('Block user error:', error)
      alert('Failed to block user.')
      return
    }

    alert('User blocked successfully.')
    window.location.reload()
  }

  const handleDelete = async (msg: ChatMessageData) => {
    if (!user) return
    if (!confirm('Delete this message?')) return

    const isOwnMsg = msg.userId === user.id
    if (!isOwnMsg && !isOwner) return

    const { error } = await supabase
      .from('community_messages')
      .delete()
      .eq('id', String(msg.id))

    if (error) {
      console.error('Delete message error:', error)
      return
    }

    setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)))
  }

  if (!ready || !user) return null

  const visibleMessages = messages.filter((m) => !blockedUsers.has(m.userId))

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white"># community</h1>
        <p className="text-xs text-zinc-500">Open to everyone</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
        {visibleMessages.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-16">No messages yet. Say hello!</p>
        )}

        {visibleMessages.map((msg, i) => {
          const prev = visibleMessages[i - 1]
          const grouped = prev?.userId === msg.userId && !msg.replyToId
          const replyTarget = msg.replyToId ? messages.find((m) => String(m.id) === String(msg.replyToId)) ?? null : null
          const senderProfile = profileMap[msg.userId]

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
              isFounder={senderProfile?.username === 'ceo' || senderProfile?.is_founder_override === true}
              isPremiumUser={senderProfile?.is_premium === true || senderProfile?.is_founder_override === true}
              presence={presenceMap[msg.userId]}
              onAvatarClick={(e, m) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setPopup({
                  userId: m.userId,
                  displayName: m.displayName,
                  avatarUrl: m.avatarUrl || undefined,
                  x: rect.right + 8,
                  y: rect.top,
                })
              }}
              onNameClick={(e, m) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setPopup({
                  userId: m.userId,
                  displayName: m.displayName,
                  avatarUrl: m.avatarUrl || undefined,
                  x: rect.left,
                  y: rect.bottom + 4,
                })
              }}
              onReply={(m) => {
                setReplyTo(m)
                inputRef.current?.focus()
              }}
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
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={replyTo ? `Reply to ${replyTo.displayName}…` : 'Message #community'}
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
