import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, ArrowLeft, Plus, Search } from 'lucide-react'
import { VerifiedBadge, FOUNDER_USERNAME } from '@/components/VerifiedBadge'
import {
  containsToxicContent,
  checkSpamCooldown,
  markMessageSent,
} from '@/lib/chat-utils'

function renderContentWithMentions(content: string) {
  const parts = content.split(/(@\w[\w.-]{0,29})/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="mention-highlight">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export const Route = createFileRoute('/messages')({
  component: MessagesPage,
})

interface Conversation {
  partnerId: string
  displayName: string
  username: string | null
  avatarUrl: string
  lastMessage: string
  lastMessageAt: string
  isLastFromMe: boolean
  unreadCount?: number
}

interface DirectMessage {
  id: number
  senderId: string
  receiverId: string
  senderDisplayName: string
  senderAvatarUrl: string
  content: string
  createdAt: string
}

interface FriendEntry {
  id: number
  displayName: string
  username: string | null
  avatarUrl: string
  netlifyId?: string
}

function Avatar({ name, url, size = 'w-10 h-10' }: { name: string; url?: string; size?: string }) {
  if (url) return <img src={url} alt={name} className={`${size} rounded-full object-cover flex-shrink-0`} />
  return (
    <div className={`${size} rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white flex-shrink-0`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function MessagesPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activePartner, setActivePartner] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [founderUserId, setFounderUserId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cooldownMsg, setCooldownMsg] = useState('')
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user])

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/direct-messages')
    if (res.ok) {
      const data = await res.json()
      setConversations(data.conversations)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) loadConversations()
  }, [user, loadConversations])

  useEffect(() => {
    if (!activePartner) return
    const fetchMessages = async () => {
      const res = await fetch(`/api/direct-messages?partnerId=${activePartner.partnerId}`)
      if (res.ok) {
        const data = await res.json()
        const msgs: DirectMessage[] = data.messages
        setFounderUserId(data.founderUserId ?? null)
        const newOnes = msgs.filter((m) => m.id > lastIdRef.current)
        if (newOnes.length) {
          setMessages((prev) => [...prev, ...newOnes])
          lastIdRef.current = msgs[msgs.length - 1]?.id ?? lastIdRef.current
        }
      }
    }
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [activePartner])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openConversation = async (conv: Conversation) => {
    setActivePartner(conv)
    setMessages([])
    lastIdRef.current = 0
    const res = await fetch(`/api/direct-messages?partnerId=${conv.partnerId}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages)
      setFounderUserId(data.founderUserId ?? null)
      if (data.messages.length) lastIdRef.current = data.messages[data.messages.length - 1].id
    }
  }

  const startNewConversation = async () => {
    setShowNewMessage(true)
    const res = await fetch('/api/friends')
    if (res.ok) {
      const data = await res.json()
      setFriends(data.friends ?? [])
    }
  }

  const selectFriend = (friend: FriendEntry) => {
    const partnerId = friend.netlifyId
    if (!partnerId) return
    const existing = conversations.find((c) => c.partnerId === partnerId)
    const conv: Conversation = existing ?? {
      partnerId,
      displayName: friend.displayName,
      username: friend.username,
      avatarUrl: friend.avatarUrl,
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      isLastFromMe: false,
    }
    setShowNewMessage(false)
    setFriendSearch('')
    openConversation(conv)
  }

  const sendMessage = async () => {
    if (!input.trim() || sending || !activePartner) return
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
      const res = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: activePartner.partnerId, content: input.trim() }),
      })
      if (res.ok) {
        const msg: DirectMessage = await res.json()
        setMessages((prev) => [...prev, msg])
        lastIdRef.current = msg.id
        setInput('')
        markMessageSent()
        loadConversations()
      }
    } finally {
      setSending(false)
    }
  }

  const deleteMessage = async (msgId: number) => {
    const res = await fetch(`/api/direct-messages?messageId=${msgId}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    }
  }

  if (!ready || !user) return null

  if (showNewMessage) {
    const filtered = friends.filter((f) =>
      !friendSearch || f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
      (f.username && f.username.toLowerCase().includes(friendSearch.toLowerCase()))
    )
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
          <button onClick={() => setShowNewMessage(false)} className="text-zinc-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-semibold text-white">New Message</h1>
        </div>
        <div className="px-5 py-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              placeholder="Search friends..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-8">
              {friends.length === 0 ? 'Add friends to start messaging' : 'No friends match your search'}
            </p>
          )}
          {filtered.map((f) => (
            <button
              key={f.id}
              onClick={() => selectFriend(f)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-zinc-900 transition-colors text-left"
            >
              <Avatar name={f.displayName} url={f.avatarUrl || undefined} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                  {f.displayName}
                  {f.username === FOUNDER_USERNAME && <VerifiedBadge username={f.username} size={14} />}
                </p>
                {f.username && <p className="text-xs text-zinc-500">@{f.username}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (activePartner) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-3">
          <button
            onClick={() => { setActivePartner(null); loadConversations() }}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <Avatar name={activePartner.displayName} url={activePartner.avatarUrl || undefined} size="w-8 h-8" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
              {activePartner.displayName}
              {activePartner.username === FOUNDER_USERNAME && <VerifiedBadge username={activePartner.username} size={14} />}
            </p>
            {activePartner.username && <p className="text-xs text-zinc-500">@{activePartner.username}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <p className="text-zinc-600 text-sm text-center mt-16">No messages yet. Say hello!</p>
          )}
          {messages.map((msg, i) => {
            const isOwn = msg.senderId === user.id
            const prev = messages[i - 1]
            const grouped = prev?.senderId === msg.senderId
            const isFounder = msg.senderId === founderUserId
            return (
              <div key={msg.id} className={`flex items-start gap-3 ${grouped ? 'mt-0.5' : 'mt-4'} group relative`}>
                {grouped ? (
                  <div className="w-8 flex-shrink-0" />
                ) : (
                  <Avatar
                    name={isOwn ? 'You' : activePartner.displayName}
                    url={(isOwn ? undefined : activePartner.avatarUrl) || msg.senderAvatarUrl || undefined}
                    size="w-8 h-8"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white">
                        {isOwn ? 'You' : activePartner.displayName}
                      </span>
                      {isFounder && <VerifiedBadge username="ceo" size={15} />}
                      <span className="text-xs text-zinc-600">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  <p className={`text-sm break-words ${isOwn ? 'text-zinc-100' : 'text-zinc-300'}`}>
                    {renderContentWithMentions(msg.content)}
                  </p>
                </div>
                {isOwn && (
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1 text-xs"
                    title="Delete"
                  >
                    &times;
                  </button>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="px-5 py-4 border-t border-zinc-800">
          {cooldownMsg && <p className="text-xs text-red-400 mb-2">{cooldownMsg}</p>}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={`Message ${activePartner.displayName}`}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
              autoFocus
            />
            <button
              onClick={sendMessage}
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

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">Messages</h1>
          <p className="text-xs text-zinc-500">Direct messages with friends</p>
        </div>
        <button
          onClick={startNewConversation}
          className="p-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
          title="New message"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center mt-20">
            <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-500 mb-3">No messages yet</p>
            <button
              onClick={startNewConversation}
              className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg"
            >
              Start a conversation
            </button>
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.partnerId}
            onClick={() => openConversation(conv)}
            className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-zinc-900 hover:bg-zinc-900/50 transition-colors text-left"
          >
            <Avatar name={conv.displayName} url={conv.avatarUrl || undefined} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                  {conv.displayName}
                  {conv.username === FOUNDER_USERNAME && <VerifiedBadge username={conv.username} size={14} />}
                </p>
                <span className="text-[10px] text-zinc-600 flex-shrink-0">
                  {new Date(conv.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xs text-zinc-500 truncate flex-1 min-w-0">
                  {conv.isLastFromMe && <span className="text-zinc-600">You: </span>}
                  {conv.lastMessage}
                </p>
                {(conv.unreadCount ?? 0) > 0 && (
                  <span className="ml-2 flex-shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {(conv.unreadCount ?? 0) > 99 ? '99+' : conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
