import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { Send, X, Clock } from 'lucide-react'
import { UserPopup } from '@/components/UserPopup'
import { ChatMessage, ChatMessageData, TypingIndicator, ReplyPreview } from '@/components/ChatMessage'
import {
  containsToxicContent,
  checkSpamCooldown,
  markMessageSent,
  getRecentInterests,
  addRecentInterest,
  getMutedUsers,
  toggleMuteUser,
} from '@/lib/chat-utils'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})

const SUGGESTED_INTERESTS = [
  'gaming', 'music', 'art', 'tech', 'sports', 'anime', 'movies',
  'cooking', 'books', 'fitness', 'travel', 'photography', 'science',
  'fashion', 'pets', 'investing', 'design', 'coding',
]

interface Room {
  id: string
  name: string
  interest: string
}

type DbMessage = {
  id: string
  room_id: string
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

function ChatPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [joining, setJoining] = useState(false)
  const [customInterest, setCustomInterest] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessageData | null>(null)
  const [typingNames, setTypingNames] = useState<string[]>([])
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())
  const [blockedUsers] = useState<Set<string>>(new Set())
  const [cooldownMsg, setCooldownMsg] = useState('')
  const [recentInterests, setRecentInterests] = useState<string[]>([])
  const [popup, setPopup] = useState<{ userId: string; displayName: string; avatarUrl?: string; x: number; y: number } | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [profileMap, setProfileMap] = useState<Record<string, any>>({})

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    setMutedUsers(getMutedUsers())
    setRecentInterests(getRecentInterests())
  }, [])

  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      setMyProfile(data)

      if (data?.username === 'ceo' || data?.is_founder_override === true) {
        setIsOwner(true)
      }
    }

    loadProfile()
  }, [user])

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

  const loadReactions = async () => {
    const { data, error } = await supabase
      .from('message_reactions')
      .select('*')
      .eq('message_type', 'chat')

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
    if (!user || !activeRoom) return

    const { error } = await supabase
      .from('chat_typing')
      .upsert({
        chat_type: 'interest',
        room_id: activeRoom.id,
        typer_id: user.id,
        receiver_id: null,
        display_name: myProfile?.display_name ?? user.name ?? user.email ?? 'User',
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Interest typing signal error:', error)
    }
  }

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

  const loadMessages = async (roomId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Interest chat messages load error:', error)
      return
    }

    const rows = data ?? []
    setMessages(rows.map(toChatMessage))
    await loadSenderProfiles(rows)
    await loadReactions()
  }

  const joinRoom = async (interestRaw: string) => {
    const interest = interestRaw.toLowerCase().trim()
    if (!interest) return

    setJoining(true)
    const roomName = `#${interest}`
    let room: Room | null = null

    const { data: existingRoom, error: findError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('interest', interest)
      .maybeSingle()

    if (findError) console.error('Find room error:', findError)

    if (existingRoom) {
      room = {
        id: existingRoom.id,
        name: existingRoom.name ?? roomName,
        interest: existingRoom.interest ?? interest,
      }
    } else {
      const { data: newRoom, error: createError } = await supabase
        .from('chat_rooms')
        .insert({ interest, name: roomName })
        .select()
        .single()

      if (createError) {
        console.error('Create room error:', createError)
        setCooldownMsg(createError.message || 'Could not join room')
        setTimeout(() => setCooldownMsg(''), 3000)
        setJoining(false)
        return
      }

      room = {
        id: newRoom.id,
        name: newRoom.name ?? roomName,
        interest: newRoom.interest ?? interest,
      }
    }

    setActiveRoom(room)
    setRooms((prev) => prev.some((r) => r.id === room!.id) ? prev : [...prev, room!])
    setMessages([])
    setReplyTo(null)
    setTypingNames([])
    addRecentInterest(interest)
    setRecentInterests(getRecentInterests())

    await loadMessages(room.id)
    setJoining(false)
  }

  useEffect(() => {
    if (!activeRoom) return

    loadMessages(activeRoom.id)

    const channel = supabase
      .channel(`chat_messages_${activeRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeRoom.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            const row = payload.new as DbMessage
            const msg = toChatMessage(row)

            loadSenderProfiles([row])

            if (prev.some((m) => String(m.id) === String(msg.id))) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeRoom])

  useEffect(() => {
    if (!user || !activeRoom) return

    const typingChannel = supabase
      .channel(`chat_typing_interest_${activeRoom.id}_${user.id}`)
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

          const isCorrectChat = row.chat_type === 'interest' && row.room_id === activeRoom.id
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
  }, [user, activeRoom])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingNames])

  const handleInputChange = async (value: string) => {
    setInput(value)

    if (!value.trim()) return
    await sendTypingSignal()
  }

  const send = async () => {
    if (!user || !input.trim() || sending || !activeRoom) return

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
      .from('chat_messages')
      .insert({
        room_id: activeRoom.id,
        user_id: user.id,
        display_name: myProfile?.display_name ?? user.name ?? user.email ?? 'User',
        avatar_url: myProfile?.avatar_url ?? '',
        content: input.trim(),
        reply_to_id: replyTo?.id ? String(replyTo.id) : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Interest chat message send error:', error)
      setCooldownMsg(error.message || 'Message failed to send')
      setTimeout(() => setCooldownMsg(''), 3000)
    } else if (data) {
      const msg = toChatMessage(data as DbMessage)

      await loadSenderProfiles([data as DbMessage])

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
      .eq('message_type', 'chat')
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
          message_type: 'chat',
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
        message_type: 'chat',
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
    if (!user || !activeRoom) return
    if (!confirm('Delete this message?')) return

    const isOwnMsg = msg.userId === user.id
    if (!isOwnMsg && !isOwner) return

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', String(msg.id))

    if (error) {
      console.error('Delete interest message error:', error)
      return
    }

    setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)))
  }

  if (!ready || !user) return null

  if (!activeRoom) {
    const displayInterests = recentInterests.length > 0 ? recentInterests : []

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950">
        <h2 className="text-lg font-semibold text-white mb-1">Pick an interest</h2>
        <p className="text-zinc-500 text-sm mb-6">You'll be placed in a room with others who share it.</p>

        {displayInterests.length > 0 && (
          <div className="mb-6 w-full max-w-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-zinc-500" />
              <span className="text-xs text-zinc-500 font-medium">Recent</span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {displayInterests.map((tag) => (
                <button
                  key={tag}
                  onClick={() => joinRoom(tag)}
                  disabled={joining}
                  className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-full text-sm text-purple-300 hover:text-purple-200 hover:border-purple-500/50 transition-colors disabled:opacity-50"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-center max-w-lg mb-6">
          {SUGGESTED_INTERESTS.map((tag) => (
            <button
              key={tag}
              onClick={() => joinRoom(tag)}
              disabled={joining}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-full text-sm text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-50"
            >
              #{tag}
            </button>
          ))}
        </div>

        <div className="flex gap-2 w-full max-w-xs">
          <input
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && customInterest.trim() && joinRoom(customInterest.trim())}
            placeholder="Custom interest…"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
          <button
            onClick={() => customInterest.trim() && joinRoom(customInterest.trim())}
            disabled={!customInterest.trim() || joining}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-50"
          >
            Join
          </button>
        </div>
      </div>
    )
  }

  const visibleMessages = messages.filter((m) => !blockedUsers.has(m.userId))

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">{activeRoom.name}</h1>
          <p className="text-xs text-zinc-500">Interest-based room</p>
        </div>

        <div className="flex items-center gap-2">
          {rooms.length > 1 && rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRoom(r)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                r.id === activeRoom.id
                  ? 'border-zinc-600 text-white'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              #{r.interest}
            </button>
          ))}

          <button
            onClick={() => {
              setActiveRoom(null)
              setTypingNames([])
            }}
            className="text-xs px-2 py-1.5 border border-zinc-800 rounded-md text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors flex items-center gap-1"
          >
            <X size={12} /> Leave
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
        {visibleMessages.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-16">No messages yet. Start the conversation!</p>
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
              messageType="chat"
              reactions={reactions[String(msg.id)] ?? []}
              replyTarget={replyTarget}
              isMuted={mutedUsers.has(msg.userId)}
              isFounder={senderProfile?.username === 'ceo' || senderProfile?.is_founder_override === true}
              isPremiumUser={senderProfile?.is_premium === true || senderProfile?.is_founder_override === true}
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
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={replyTo ? `Reply to ${replyTo.displayName}…` : `Message ${activeRoom.name}`}
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
