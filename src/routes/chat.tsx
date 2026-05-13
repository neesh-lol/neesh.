import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect, useRef, useState, useCallback } from 'react'
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
  getBlockedUsers,
  setBlockedUsers,
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
  id: number
  name: string
  interest: string
}

type ReactionMap = Record<number, Array<{ emoji: string; userId: string; displayName: string }>>

function ChatPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [founderUserId, setFounderUserId] = useState<string | null>(null)
  const [premiumUserIds, setPremiumUserIds] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [joining, setJoining] = useState(false)
  const [customInterest, setCustomInterest] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessageData | null>(null)
  const [typingNames, setTypingNames] = useState<string[]>([])
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())
  const [blockedUsers, setBlockedUsersState] = useState<Set<string>>(new Set())
  const [cooldownMsg, setCooldownMsg] = useState('')
  const [recentInterests, setRecentInterests] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef(0)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)
  const [popup, setPopup] = useState<{ userId: string; displayName: string; avatarUrl?: string; x: number; y: number } | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user])

  useEffect(() => {
    if (!user) return
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.username === 'ceo') setIsOwner(true) })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    setMutedUsers(getMutedUsers())
    setBlockedUsersState(getBlockedUsers())
    setRecentInterests(getRecentInterests())
    fetch('/api/blocks')
      .then((r) => r.ok ? r.json() : [])
      .then((blocks: Array<{ blockedId: string }>) => {
        const ids = blocks.map((b) => b.blockedId)
        setBlockedUsers(ids)
        setBlockedUsersState(new Set(ids))
      })
      .catch(() => {})
  }, [user])

  const joinRoom = async (interest: string) => {
    setJoining(true)
    try {
      const res = await fetch('/api/chat-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest }),
      })
      if (res.ok) {
        const room: Room = await res.json()
        setActiveRoom(room)
        if (!rooms.find((r) => r.id === room.id)) setRooms((prev) => [...prev, room])
        setMessages([])
        setReactions({})
        lastIdRef.current = 0
        addRecentInterest(interest.toLowerCase().trim())
        setRecentInterests(getRecentInterests())
        const msgRes = await fetch(`/api/chat-messages?roomId=${room.id}`)
        if (msgRes.ok) {
          const data = await msgRes.json()
          setMessages(data.messages ?? data)
          setReactions(data.reactions ?? {})
          setFounderUserId(data.founderUserId ?? null)
          if (data.premiumUserIds) setPremiumUserIds(new Set(data.premiumUserIds))
          const msgs = data.messages ?? data
          lastIdRef.current = msgs[msgs.length - 1]?.id ?? 0
        }
      }
    } finally {
      setJoining(false)
    }
  }

  useEffect(() => {
    if (!activeRoom) return
    const fetchNew = async () => {
      const res = await fetch(`/api/chat-messages?roomId=${activeRoom.id}`)
      if (res.ok) {
        const data = await res.json()
        const msgs: ChatMessageData[] = data.messages ?? data
        setReactions(data.reactions ?? {})
        setFounderUserId(data.founderUserId ?? null)
        if (data.premiumUserIds) setPremiumUserIds(new Set(data.premiumUserIds))
        const newOnes = msgs.filter((m) => m.id > lastIdRef.current)
        if (newOnes.length) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id))
            const filtered = newOnes.filter((m) => !existingIds.has(m.id))
            return [...prev, ...filtered]
          })
          lastIdRef.current = msgs[msgs.length - 1]?.id ?? lastIdRef.current
        }
      }
    }
    const interval = setInterval(fetchNew, 3000)
    return () => clearInterval(interval)
  }, [activeRoom])

  useEffect(() => {
    if (!activeRoom || !user) return
    const fetchTyping = async () => {
      const res = await fetch(`/api/typing?roomType=chat&roomId=${activeRoom.id}&excludeUserId=${user.id}`)
      if (res.ok) {
        const data: Array<{ displayName: string }> = await res.json()
        setTypingNames(data.map((d) => d.displayName))
      }
    }
    const interval = setInterval(fetchTyping, 3000)
    return () => clearInterval(interval)
  }, [activeRoom, user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendTypingIndicator = useCallback(() => {
    if (!activeRoom) return
    fetch('/api/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomType: 'chat', roomId: activeRoom.id }),
    }).catch(() => {})
  }, [activeRoom])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTypingIndicator()
    typingTimerRef.current = setTimeout(() => {}, 3000)
  }

  const send = async () => {
    if (!input.trim() || sending || !activeRoom) return
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
    try {
      const res = await fetch('/api/chat-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: activeRoom.id,
          content: input.trim(),
          replyToId: replyTo?.id || null,
        }),
      })
      if (res.ok) {
        const msg: ChatMessageData = await res.json()
        setMessages((prev) => [...prev, msg])
        lastIdRef.current = msg.id
        setInput('')
        setReplyTo(null)
        markMessageSent()
      }
    } finally {
      setSending(false)
    }
  }

  const handleReact = async (messageId: number, emoji: string) => {
    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'chat', messageId, emoji }),
    })
    if (res.ok) {
      const msgRes = await fetch(`/api/chat-messages?roomId=${activeRoom!.id}`)
      if (msgRes.ok) {
        const data = await msgRes.json()
        setReactions(data.reactions ?? {})
      }
    }
  }

  const handleReport = async (msg: ChatMessageData) => {
    const reason = prompt('Why are you reporting this message?')
    if (!reason?.trim()) return
    await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageType: 'chat', messageId: msg.id, reason }),
    })
    alert('Report submitted')
  }

  const handleMute = (userId: string) => {
    const nowMuted = toggleMuteUser(userId)
    setMutedUsers(getMutedUsers())
    alert(nowMuted ? 'User muted' : 'User unmuted')
  }

  const handleBlock = async (userId: string) => {
    if (!confirm('Block this user? You won\'t see their messages.')) return
    await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedId: userId }),
    })
    const res = await fetch('/api/blocks')
    if (res.ok) {
      const blocks: Array<{ blockedId: string }> = await res.json()
      const ids = blocks.map((b) => b.blockedId)
      setBlockedUsers(ids)
      setBlockedUsersState(new Set(ids))
    }
  }

  const handleDelete = async (msg: ChatMessageData) => {
    if (!confirm('Delete this message?')) return
    const isOwnMsg = msg.userId === user?.id
    let res
    if (isOwnMsg) {
      res = await fetch(`/api/chat-messages?messageId=${msg.id}`, { method: 'DELETE' })
    } else if (isOwner) {
      res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-message', messageId: msg.id, messageType: 'chat' }),
      })
    }
    if (res?.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
    }
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
              onClick={() => {
                setActiveRoom(r)
                setMessages([])
                setReactions({})
                lastIdRef.current = 0
                fetch(`/api/chat-messages?roomId=${r.id}`)
                  .then((res) => res.json())
                  .then((data) => {
                    setMessages(data.messages ?? data)
                    setReactions(data.reactions ?? {})
                    setFounderUserId(data.founderUserId ?? null)
                    if (data.premiumUserIds) setPremiumUserIds(new Set(data.premiumUserIds))
                    const msgs = data.messages ?? data
                    lastIdRef.current = msgs[msgs.length - 1]?.id ?? 0
                  })
              }}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${r.id === activeRoom.id ? 'border-zinc-600 text-white' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
            >
              #{r.interest}
            </button>
          ))}
          <button
            onClick={() => setActiveRoom(null)}
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
          const replyTarget = msg.replyToId ? messages.find((m) => m.id === msg.replyToId) ?? null : null
          return (
            <ChatMessage
              key={msg.id}
              msg={msg}
              grouped={grouped}
              currentUserId={user.id}
              messageType="chat"
              reactions={reactions[msg.id] ?? []}
              replyTarget={replyTarget}
              isMuted={mutedUsers.has(msg.userId)}
              isFounder={founderUserId != null && msg.userId === founderUserId}
              isPremiumUser={premiumUserIds.has(msg.userId)}
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
            onChange={handleInputChange}
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
