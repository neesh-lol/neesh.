import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { UserPopup } from '@/components/UserPopup'
import { ChatMessage, ChatMessageData, TypingIndicator, ReplyPreview } from '@/components/ChatMessage'
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
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessageData | null>(null)
  const [typingNames] = useState<string[]>([])
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())
  const [blockedUsers] = useState<Set<string>>(new Set())
  const [cooldownMsg, setCooldownMsg] = useState('')
  const [popup, setPopup] = useState<{ userId: string; displayName: string; avatarUrl?: string; x: number; y: number } | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [myProfile, setMyProfile] = useState<any>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    setMutedUsers(getMutedUsers())
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
      if (data?.username === 'ceo') setIsOwner(true)
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

      setMessages((data ?? []).map(toChatMessage))
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
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
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

    const insertRow = {
      user_id: user.id,
      display_name: myProfile?.display_name ?? user.name ?? user.email ?? 'User',
      avatar_url: myProfile?.avatar_url ?? '',
      content: input.trim(),
      reply_to_id: replyTo?.id ? String(replyTo.id) : null,
    }

    const { data, error } = await supabase
      .from('community_messages')
      .insert(insertRow)
      .select()
      .single()

    if (error) {
      console.error('Community message send error:', error)
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
    }

    setSending(false)
  }

  const handleReact = async () => {
    setCooldownMsg('Reactions are being rebuilt for Supabase.')
    setTimeout(() => setCooldownMsg(''), 2000)
  }

  const handleReport = async () => {
    alert('Reports are being rebuilt for Supabase.')
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

          return (
            <ChatMessage
              key={String(msg.id)}
              msg={msg}
              grouped={grouped}
              currentUserId={user.id}
              messageType="community"
              reactions={[]}
              replyTarget={replyTarget}
              isMuted={mutedUsers.has(msg.userId)}
              isFounder={myProfile?.username === 'ceo' && msg.userId === user.id}
              isPremiumUser={false}
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
