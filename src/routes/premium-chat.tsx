import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, Crown, Lock } from 'lucide-react'
import { UserPopup } from '@/components/UserPopup'
import { ChatMessage, ChatMessageData, TypingIndicator, ReplyPreview } from '@/components/ChatMessage'
import {
  containsToxicContent,
  checkSpamCooldown,
  markMessageSent,
  getMutedUsers,
  toggleMuteUser,
  getBlockedUsers,
  setBlockedUsers,
} from '@/lib/chat-utils'

export const Route = createFileRoute('/premium-chat')({
  component: PremiumChatPage,
})

type ReactionMap = Record<number, Array<{ emoji: string; userId: string; displayName: string }>>

function PremiumChatPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [founderUserId, setFounderUserId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessageData | null>(null)
  const [typingNames, setTypingNames] = useState<string[]>([])
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())
  const [blockedUsers, setBlockedUsersState] = useState<Set<string>>(new Set())
  const [cooldownMsg, setCooldownMsg] = useState('')
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef(0)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)
  const [popup, setPopup] = useState<{ userId: string; displayName: string; avatarUrl?: string; x: number; y: number } | null>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user])

  useEffect(() => {
    if (!user) return
    fetch('/api/subscription')
      .then(r => r.json())
      .then(d => setIsPremium(d.isPremium))
      .catch(() => setIsPremium(false))
  }, [user])

  useEffect(() => {
    setMutedUsers(getMutedUsers())
    setBlockedUsersState(getBlockedUsers())
    fetch('/api/blocks')
      .then((r) => r.ok ? r.json() : [])
      .then((blocks: Array<{ blockedId: string }>) => {
        const ids = blocks.map((b) => b.blockedId)
        setBlockedUsers(ids)
        setBlockedUsersState(new Set(ids))
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user || isPremium !== true) return
    fetch('/api/premium-messages')
      .then((r) => r.json())
      .then((data) => {
        const msgs: ChatMessageData[] = data.messages ?? []
        setMessages(msgs)
        setReactions(data.reactions ?? {})
        setFounderUserId(data.founderUserId ?? null)
        lastIdRef.current = msgs[msgs.length - 1]?.id ?? 0
      })
    const fetchNew = async () => {
      const res = await fetch('/api/premium-messages')
      if (res.ok) {
        const data = await res.json()
        const msgs: ChatMessageData[] = data.messages ?? []
        setReactions(data.reactions ?? {})
        setFounderUserId(data.founderUserId ?? null)
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
  }, [user, isPremium])

  useEffect(() => {
    if (!user || isPremium !== true) return
    const fetchTyping = async () => {
      const res = await fetch(`/api/typing?roomType=premium&excludeUserId=${user.id}`)
      if (res.ok) {
        const data: Array<{ displayName: string }> = await res.json()
        setTypingNames(data.map((d) => d.displayName))
      }
    }
    const interval = setInterval(fetchTyping, 3000)
    return () => clearInterval(interval)
  }, [user, isPremium])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendTypingIndicator = useCallback(() => {
    fetch('/api/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomType: 'premium' }),
    }).catch(() => {})
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    sendTypingIndicator()
    typingTimerRef.current = setTimeout(() => {}, 3000)
  }

  const send = async () => {
    if (!input.trim() || sending) return
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
      const res = await fetch('/api/premium-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      body: JSON.stringify({ messageType: 'premium', messageId, emoji }),
    })
    if (res.ok) {
      const msgRes = await fetch('/api/premium-messages')
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
      body: JSON.stringify({ messageType: 'premium', messageId: msg.id, reason }),
    })
    alert('Report submitted')
  }

  const handleMute = (userId: string) => {
    toggleMuteUser(userId)
    setMutedUsers(getMutedUsers())
  }

  const handleBlock = async (userId: string) => {
    if (!confirm('Block this user?')) return
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
    const res = await fetch(`/api/premium-messages?messageId=${msg.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
    }
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
          <p className="text-zinc-600 text-sm text-center mt-16">Welcome to the NEESH.+ lounge. Start the conversation!</p>
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
              messageType="community"
              reactions={reactions[msg.id] ?? []}
              replyTarget={replyTarget}
              isMuted={mutedUsers.has(msg.userId)}
              isFounder={founderUserId != null && msg.userId === founderUserId}
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
