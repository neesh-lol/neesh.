import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
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
  isFounder?: boolean
}

interface DirectMessage {
  id: string
  senderId: string
  receiverId: string
  senderDisplayName: string
  senderAvatarUrl: string
  content: string
  createdAt: string
}

interface FriendEntry {
  id: string
  displayName: string
  username: string | null
  avatarUrl: string
  netlifyId: string
  isFounder?: boolean
}

function Avatar({ name, url, size = 'w-10 h-10' }: { name: string; url?: string; size?: string }) {
  if (url) return <img src={url} alt={name} className={`${size} rounded-full object-cover flex-shrink-0`} />
  return (
    <div className={`${size} rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white flex-shrink-0`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function mapMessage(row: any, profileMap: Map<string, any>): DirectMessage {
  const senderProfile = profileMap.get(row.sender_id)

  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    senderDisplayName: senderProfile?.display_name ?? 'User',
    senderAvatarUrl: senderProfile?.avatar_url ?? '',
    content: row.content,
    createdAt: row.created_at,
  }
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
  const [typingName, setTypingName] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  const loadFounder = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', FOUNDER_USERNAME)
      .maybeSingle()

    setFounderUserId(data?.id ?? null)
  }, [])

  const loadConversations = useCallback(async () => {
    if (!user) return

    setLoading(true)

    const { data: dmRows, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Conversation load error:', error)
      setConversations([])
      setLoading(false)
      return
    }

    const rows = dmRows ?? []
    const partnerIds = Array.from(
      new Set(
        rows.map((m: any) => (m.sender_id === user.id ? m.receiver_id : m.sender_id))
      )
    )

    if (partnerIds.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', partnerIds)

    if (profileError) {
      console.error('Conversation profile load error:', profileError)
      setConversations([])
      setLoading(false)
      return
    }

    const profileMap = new Map<string, any>()
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p)
    }

    const convMap = new Map<string, Conversation>()

    for (const msg of rows) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
      const partner = profileMap.get(partnerId)
      if (!partner) continue

      if (!convMap.has(partnerId)) {
        const unreadCount = rows.filter(
          (m: any) =>
            m.sender_id === partnerId &&
            m.receiver_id === user.id &&
            !m.read_at
        ).length

        convMap.set(partnerId, {
          partnerId,
          displayName: partner.display_name ?? 'User',
          username: partner.username ?? null,
          avatarUrl: partner.avatar_url ?? '',
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          isLastFromMe: msg.sender_id === user.id,
          unreadCount,
          isFounder: partner.username === FOUNDER_USERNAME,
        })
      }
    }

    setConversations(Array.from(convMap.values()))
    setLoading(false)
  }, [user])

  const loadMessages = async (partnerId: string) => {
    if (!user) return

    const { data: rows, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })

    if (error) {
      console.error('DM load error:', error)
      setMessages([])
      return
    }

    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', partnerId)
      .eq('receiver_id', user.id)
      .is('read_at', null)

    const userIds = Array.from(
      new Set((rows ?? []).flatMap((m: any) => [m.sender_id, m.receiver_id]))
    )

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)

    const profileMap = new Map<string, any>()
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p)
    }

    setMessages((rows ?? []).map((row: any) => mapMessage(row, profileMap)))
    await loadConversations()
  }

  const sendTypingSignal = async () => {
    if (!user || !activePartner) return

    await supabase
      .from('dm_typing')
      .upsert({
        typer_id: user.id,
        receiver_id: activePartner.partnerId,
        updated_at: new Date().toISOString(),
      })
  }

  const handleInputChange = (value: string) => {
    setInput(value)

    if (!value.trim()) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingSignal()
    }, 150)
  }

  useEffect(() => {
    if (!user) return
    loadFounder()
    loadConversations()
  }, [user, loadFounder, loadConversations])

  useEffect(() => {
    if (!user) return

    const dmChannel = supabase
      .channel(`direct_messages_global_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload: any) => {
          const row = payload.new ?? payload.old
          if (!row) return

          const belongsToMe =
            row.sender_id === user.id ||
            row.receiver_id === user.id

          if (!belongsToMe) return

          const isActiveConversation =
            activePartner &&
            (
              (row.sender_id === user.id && row.receiver_id === activePartner.partnerId) ||
              (row.sender_id === activePartner.partnerId && row.receiver_id === user.id)
            )

          if (isActiveConversation && activePartner) {
            loadMessages(activePartner.partnerId)
          } else {
            loadConversations()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(dmChannel)
    }
  }, [user, activePartner])

  useEffect(() => {
    if (!user || !activePartner) return

    const typingChannel = supabase
      .channel(`dm_typing_${user.id}_${activePartner.partnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dm_typing',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const row = payload.new
          if (!row) return

          if (row.typer_id !== activePartner.partnerId) return

          const updatedAt = new Date(row.updated_at).getTime()
          const now = Date.now()
          const isFresh = now - updatedAt < 5000

          if (!isFresh) return

          setTypingName(activePartner.displayName)

          setTimeout(() => {
            setTypingName('')
          }, 3000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(typingChannel)
      setTypingName('')
    }
  }, [user, activePartner])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingName])

  const openConversation = async (conv: Conversation) => {
    setActivePartner(conv)
    setMessages([])
    setTypingName('')
    setShowNewMessage(false)
    setFriendSearch('')
    await loadMessages(conv.partnerId)
  }

  const startNewConversation = async () => {
    if (!user) return

    setShowNewMessage(true)

    const { data: friendshipRows, error } = await supabase
      .from('friendships')
      .select('*')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)

    if (error) {
      console.error('Friend list load error:', error)
      setFriends([])
      return
    }

    const friendIds = Array.from(
      new Set(
        (friendshipRows ?? []).map((f: any) =>
          f.requester_id === user.id ? f.receiver_id : f.requester_id
        )
      )
    )

    if (friendIds.length === 0) {
      setFriends([])
      return
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', friendIds)

    if (profileError) {
      console.error('Friend profile list error:', profileError)
      setFriends([])
      return
    }

    setFriends(
      (profiles ?? []).map((p: any) => ({
        id: p.id,
        netlifyId: p.id,
        displayName: p.display_name ?? 'User',
        username: p.username ?? null,
        avatarUrl: p.avatar_url ?? '',
        isFounder: p.username === FOUNDER_USERNAME,
      }))
    )
  }

  const selectFriend = (friend: FriendEntry) => {
    const existing = conversations.find((c) => c.partnerId === friend.netlifyId)

    const conv: Conversation = existing ?? {
      partnerId: friend.netlifyId,
      displayName: friend.displayName,
      username: friend.username,
      avatarUrl: friend.avatarUrl,
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      isLastFromMe: false,
      unreadCount: 0,
      isFounder: friend.username === FOUNDER_USERNAME,
    }

    openConversation(conv)
  }

  const sendMessage = async () => {
    if (!user || !input.trim() || sending || !activePartner) return

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

    const { error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: user.id,
        receiver_id: activePartner.partnerId,
        content: input.trim(),
      })

    if (error) {
      console.error('Send DM error:', error)
      setCooldownMsg(error.message || 'Message failed to send')
      setTimeout(() => setCooldownMsg(''), 3000)
      setSending(false)
      return
    }

    setInput('')
    markMessageSent()
    await loadMessages(activePartner.partnerId)
    setSending(false)
  }

  const deleteMessage = async (msgId: string) => {
    if (!user) return

    const { error } = await supabase
      .from('direct_messages')
      .delete()
      .eq('id', msgId)
      .eq('sender_id', user.id)

    if (error) {
      console.error('Delete DM error:', error)
      return
    }

    setMessages((prev) => prev.filter((m) => m.id !== msgId))
    await loadConversations()
  }

  if (!ready || !user) return null

  if (showNewMessage) {
    const filtered = friends.filter((f) =>
      !friendSearch ||
      f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
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
            onClick={() => {
              setActivePartner(null)
              setTypingName('')
              loadConversations()
            }}
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

          {typingName && (
            <div className="flex items-center gap-2 mt-4 text-xs text-zinc-500">
              <span>{typingName} is typing</span>
              <span className="animate-pulse">...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="px-5 py-4 border-t border-zinc-800">
          {cooldownMsg && <p className="text-xs text-red-400 mb-2">{cooldownMsg}</p>}

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
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
