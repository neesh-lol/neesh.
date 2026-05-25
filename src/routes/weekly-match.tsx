import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useIdentity } from '@/lib/identity-context'
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Users, Clock, Wand2 } from 'lucide-react'
import { UserPopup } from '@/components/UserPopup'
import { ChatMessage, ChatMessageData, ReplyPreview, PresenceInfo } from '@/components/ChatMessage'
import {
  containsToxicContent,
  checkSpamCooldown,
  markMessageSent,
  getMutedUsers,
  toggleMuteUser,
} from '@/lib/chat-utils'

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

type DbMessage = {
  id: string
  group_id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  content: string
  reply_to_id?: string | null
  created_at: string
}

type Group = {
  id: string
  created_at: string
  expires_at: string
}

type ReactionMap = Record<string, Array<{ emoji: string; userId: string; displayName: string }>>

function getDisplayName(member: Member) {
  return member.profiles?.display_name || member.profiles?.username || 'User'
}

function getLevel(totalXp: number) {
  return Math.min(100, Math.floor(totalXp / 1000) + 1)
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

function WeeklyMatchPage() {
  const { user, ready } = useIdentity()
  const navigate = useNavigate()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<ChatMessageData[]>([])
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [myProfile, setMyProfile] = useState<any>(null)
  const [profileMap, setProfileMap] = useState<Record<string, any>>({})
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceInfo>>({})
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())
  const [blockedUsers] = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo] = useState<ChatMessageData | null>(null)
  const [cooldownMsg, setCooldownMsg] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState('')
  const [popup, setPopup] = useState<{ userId: string; displayName: string; avatarUrl?: string; x: number; y: number } | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ready && !user) navigate({ to: '/signin' })
  }, [ready, user, navigate])

  useEffect(() => {
    setMutedUsers(getMutedUsers())
  }, [])

  const loadSenderProfiles = async (messageRows: DbMessage[]) => {
    const userIds = Array.from(new Set(messageRows.map((m) => m.user_id))).filter(Boolean)

    if (userIds.length === 0) return

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, is_premium, is_founder_override')
      .in('id', userIds)

    if (error) {
      console.error('Weekly match sender profile load error:', error)
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
      console.error('Weekly match presence load error:', error)
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
      .eq('message_type', 'weekly_match')

    if (error) {
      console.error('Weekly match reaction load error:', error)
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

    const cleanMembers = (memberRows ?? []) as Member[]
    setMembers(cleanMembers)

    const memberUserIds = cleanMembers.map((m) => m.user_id)
    await loadPresence(memberUserIds)

    const { data: messageRows, error: messagesError } = await supabase
      .from('weekly_match_messages')
      .select('*')
      .eq('group_id', matchGroup.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Weekly match messages error:', messagesError)
    }

    const rows = (messageRows ?? []) as DbMessage[]
    const messageUserIds = Array.from(new Set(rows.map((m) => m.user_id)))

    setMessages(rows.map(toChatMessage))
    await loadSenderProfiles(rows)
    await loadPresence([...memberUserIds, ...messageUserIds])
    await loadReactions()

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
          const row = payload.new as DbMessage
          const msg = toChatMessage(row)

          loadSenderProfiles([row])
          loadPresence([row.user_id])

          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(msg.id))) return prev
            return [...prev, msg]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'weekly_match_messages',
          filter: `group_id=eq.${group.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string }
          if (!oldRow?.id) return
          setMessages((prev) => prev.filter((m) => String(m.id) !== String(oldRow.id)))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group])

  useEffect(() => {
    if (!user || !group) return

    const presenceChannel = supabase
      .channel(`weekly_match_presence_${group.id}_${user.id}`)
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
  }, [user, group])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const generateWeeklyMatches = async () => {
    if (!user || myProfile?.username !== 'ceo') return

    setGenerating(true)
    setGenerateMsg('')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: optedInUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .eq('weekly_match_opt_in', true)

    if (usersError) {
      console.error('Weekly match users load error:', usersError)
      setGenerateMsg(usersError.message)
      setGenerating(false)
      return
    }

    const users = (optedInUsers ?? []).filter((profile: any) => profile.id)

    if (users.length < 2) {
      setGenerateMsg('Need at least 2 opted-in users to generate weekly matches.')
      setGenerating(false)
      return
    }

    const shuffled = [...users].sort(() => Math.random() - 0.5)
    const groups: any[][] = []

    for (let i = 0; i < shuffled.length; i += 4) {
      groups.push(shuffled.slice(i, i + 4))
    }

    if (groups.length > 1 && groups[groups.length - 1].length === 1) {
      const lastUser = groups.pop()?.[0]
      if (lastUser) {
        groups[groups.length - 1].push(lastUser)
      }
    }

    let createdGroups = 0
    let matchedUsers = 0

    for (const usersInGroup of groups) {
      if (usersInGroup.length < 2) continue

      const { data: createdGroup, error: groupError } = await supabase
        .from('weekly_match_groups')
        .insert({
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .maybeSingle()

      if (groupError || !createdGroup) {
        console.error('Weekly match group create error:', groupError)
        continue
      }

      const memberRows = usersInGroup.map((profile: any) => ({
        group_id: createdGroup.id,
        user_id: profile.id,
      }))

      const { error: membersError } = await supabase
        .from('weekly_match_members')
        .insert(memberRows)

      if (membersError) {
        console.error('Weekly match members create error:', membersError)
        continue
      }

      const notificationRows = usersInGroup.map((profile: any) => ({
        user_id: profile.id,
        actor_id: user.id,
        type: 'weekly_match_ready',
        title: 'Weekly Match Ready',
        body: `You were matched with ${usersInGroup.length - 1} new ${usersInGroup.length - 1 === 1 ? 'person' : 'people'}.`,
        link: '/weekly-match',
      }))

      await supabase.from('notifications').insert(notificationRows)

      createdGroups += 1
      matchedUsers += usersInGroup.length
    }

    setGenerateMsg(`Created ${createdGroups} weekly match ${createdGroups === 1 ? 'group' : 'groups'} for ${matchedUsers} users.`)
    await loadWeeklyMatch()
    setGenerating(false)
  }

  const send = async () => {
    if (!user || !group || !input.trim() || sending) return

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
      .from('weekly_match_messages')
      .insert({
        group_id: group.id,
        user_id: user.id,
        display_name: myProfile?.display_name ?? user.name ?? user.email ?? 'User',
        avatar_url: myProfile?.avatar_url ?? '',
        content: input.trim(),
        reply_to_id: replyTo?.id ? String(replyTo.id) : null,
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Weekly match send error:', error)
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
      setReplyTo(null)
      markMessageSent()
    }

    setSending(false)
  }

  const handleReact = async (messageId: number, emoji: string) => {
    if (!user) return

    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_type', 'weekly_match')
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
          message_type: 'weekly_match',
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
        message_type: 'weekly_match',
        message_id: String(msg.id),
        reason: reason.trim() || 'No reason provided',
        message_content: msg.content,
      })

    if (error) {
      console.error('Report weekly match message error:', error)
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
    if (msg.userId !== user.id && myProfile?.username !== 'ceo') return
    if (!confirm('Delete this message?')) return

    const { error } = await supabase
      .from('weekly_match_messages')
      .delete()
      .eq('id', String(msg.id))

    if (error) {
      console.error('Delete weekly match message error:', error)
      alert('Failed to delete message.')
      return
    }

    setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)))
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

            {myProfile?.username === 'ceo' && (
              <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left">
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <Wand2 size={15} className="text-purple-400" />
                  CEO Tools
                </p>
                <p className="text-xs text-zinc-500 mt-1 mb-3">
                  Manually generate weekly matches for everyone who enabled Weekly Match Drops.
                </p>
                <button
                  onClick={generateWeeklyMatches}
                  disabled={generating}
                  className="w-full px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {generating ? 'Generating…' : 'Generate Weekly Matches'}
                </button>
                {generateMsg && (
                  <p className="text-xs text-zinc-400 mt-3">{generateMsg}</p>
                )}
              </div>
            )}

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
  const visibleMessages = messages.filter((m) => !blockedUsers.has(m.userId))

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

      {myProfile?.username === 'ceo' && (
        <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-950">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-white flex items-center gap-2">
                <Wand2 size={14} className="text-purple-400" />
                CEO Tools
              </p>
              <p className="text-[11px] text-zinc-500">
                Generate a new batch of weekly matches whenever you're ready.
              </p>
              {generateMsg && <p className="text-[11px] text-zinc-400 mt-1">{generateMsg}</p>}
            </div>

            <button
              onClick={generateWeeklyMatches}
              disabled={generating}
              className="px-3 py-2 bg-white text-zinc-950 rounded-lg text-xs font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
        {visibleMessages.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center mt-16">No messages yet. Say hi to your weekly match.</p>
        ) : (
          visibleMessages.map((msg, i) => {
            const prev = visibleMessages[i - 1]
            const grouped = prev?.userId === msg.userId && !msg.replyToId
            const replyTarget = msg.replyToId
              ? messages.find((m) => String(m.id) === String(msg.replyToId)) ?? null
              : null
            const senderProfile = profileMap[msg.userId]

            return (
              <ChatMessage
                key={String(msg.id)}
                msg={msg}
                grouped={grouped}
                currentUserId={user.id}
                messageType="weekly_match"
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
                isAdmin={myProfile?.username === 'ceo'}
              />
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
            placeholder={replyTo ? `Reply to ${replyTo.displayName}…` : 'Message your weekly match'}
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
