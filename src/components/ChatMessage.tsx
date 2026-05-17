import { useState, useRef, useEffect } from 'react'
import { Reply, Flag, VolumeX, Volume2, Ban, Smile, Trash2 } from 'lucide-react'
import { REACTION_EMOJIS } from '@/lib/chat-utils'
import { VerifiedBadge } from '@/components/VerifiedBadge'

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

export interface ChatMessageData {
  id: number
  userId: string
  displayName: string
  avatarUrl: string
  content: string
  replyToId?: number | null
  createdAt: string
}

interface ReactionData {
  emoji: string
  userId: string
  displayName: string
}

export interface PresenceInfo {
  status: string
  lastSeen: string | null
}

interface ChatMessageProps {
  msg: ChatMessageData
  grouped: boolean
  currentUserId: string
  messageType: 'chat' | 'community'
  reactions: ReactionData[]
  replyTarget?: ChatMessageData | null
  isMuted: boolean
  isFounder?: boolean
  isPremiumUser?: boolean
  presence?: PresenceInfo
  onAvatarClick: (e: React.MouseEvent, msg: ChatMessageData) => void
  onNameClick: (e: React.MouseEvent, msg: ChatMessageData) => void
  onReply: (msg: ChatMessageData) => void
  onReact: (messageId: number, emoji: string) => void
  onReport: (msg: ChatMessageData) => void
  onMute: (userId: string) => void
  onBlock: (userId: string) => void
  onDelete?: (msg: ChatMessageData) => void
  isDelivered?: boolean
  isAdmin?: boolean
}

function isPresenceOnline(presence?: PresenceInfo) {
  if (!presence?.lastSeen) return false

  return (
    presence.status === 'online' &&
    Date.now() - new Date(presence.lastSeen).getTime() < 90000
  )
}

function Avatar({
  name,
  url,
  presence,
}: {
  name: string
  url?: string
  presence?: PresenceInfo
}) {
  const online = isPresenceOnline(presence)

  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}

      {presence && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
            online ? 'bg-emerald-400' : 'bg-zinc-600'
          }`}
        />
      )}
    </div>
  )
}

export function ChatMessage({
  msg,
  grouped,
  currentUserId,
  reactions,
  replyTarget,
  isMuted,
  isFounder,
  isPremiumUser,
  presence,
  onAvatarClick,
  onNameClick,
  onReply,
  onReact,
  onReport,
  onMute,
  onBlock,
  onDelete,
  isDelivered,
  isAdmin,
}: ChatMessageProps) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
        setShowContextMenu(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (isMuted) {
    return (
      <div className={`flex items-start gap-3 ${grouped ? 'mt-0.5' : 'mt-4'} msg-enter group`}>
        {grouped ? (
          <div className="w-8 flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0" />
        )}

        <div className="flex items-center gap-2">
          <p className="text-xs text-zinc-600 italic">Message from muted user</p>

          <button
            onClick={() => onMute(msg.userId)}
            className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all px-2 py-0.5 rounded-md hover:bg-zinc-800"
          >
            <Volume2 size={12} /> Unmute
          </button>
        </div>
      </div>
    )
  }

  const groupedReactions: Record<string, { count: number; users: string[]; hasOwn: boolean }> = {}

  for (const r of reactions) {
    if (!groupedReactions[r.emoji]) {
      groupedReactions[r.emoji] = { count: 0, users: [], hasOwn: false }
    }

    groupedReactions[r.emoji].count++
    groupedReactions[r.emoji].users.push(r.displayName)

    if (r.userId === currentUserId) {
      groupedReactions[r.emoji].hasOwn = true
    }
  }

  const isOwn = msg.userId === currentUserId

  return (
    <div
      className={`flex items-start gap-3 ${grouped ? 'mt-0.5' : 'mt-4'} group msg-enter relative`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        if (!showEmojiPicker && !showContextMenu) setShowActions(false)
      }}
    >
      {grouped ? (
        <div className="w-8 flex-shrink-0" />
      ) : (
        <button className="flex-shrink-0" onClick={(e) => onAvatarClick(e, msg)}>
          <Avatar
            name={msg.displayName}
            url={msg.avatarUrl || undefined}
            presence={presence}
          />
        </button>
      )}

      <div className="min-w-0 flex-1">
        {replyTarget && (
          <div className="flex items-center gap-1.5 mb-1 text-xs text-zinc-500">
            <Reply size={12} className="rotate-180" />
            <span className="font-medium text-zinc-400">{replyTarget.displayName}</span>
            <span className="truncate max-w-[200px]">{replyTarget.content}</span>
          </div>
        )}

        {!grouped && (
          <div className="flex items-center gap-2 mb-0.5">
            <button
              className="text-sm font-medium text-white hover:underline"
              onClick={(e) => onNameClick(e, msg)}
            >
              {msg.displayName}
            </button>

            {isFounder && <VerifiedBadge username="ceo" size={15} />}
            {!isFounder && isPremiumUser && <VerifiedBadge isPremium size={15} />}

            <span className="text-xs text-zinc-600">
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>

            {isOwn && isDelivered && (
              <span className="text-[10px] text-zinc-600" title="Delivered">
                ✓✓
              </span>
            )}
          </div>
        )}

        <p className={`text-sm break-words ${isOwn ? 'text-zinc-100' : 'text-zinc-300'}`}>
          {renderContentWithMentions(msg.content)}
        </p>

        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(groupedReactions).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all reaction-btn ${
                  data.hasOwn
                    ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
                title={data.users.join(', ')}
              >
                <span>{emoji}</span>
                <span>{data.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showActions && (
        <div
          ref={actionsRef}
          className="absolute right-0 -top-3 flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-lg px-1 py-0.5 shadow-lg z-10 action-bar"
        >
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            title="React"
          >
            <Smile size={14} />
          </button>

          <button
            onClick={() => onReply(msg)}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Reply"
          >
            <Reply size={14} />
          </button>

          {(isOwn || isAdmin) && onDelete && (
            <button
              onClick={() => {
                onDelete(msg)
                setShowActions(false)
              }}
              className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}

          {!isOwn && (
            <button
              onClick={() => setShowContextMenu(!showContextMenu)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
              title="More"
            >
              <span className="text-xs font-bold">⋯</span>
            </button>
          )}

          {showEmojiPicker && (
            <div className="absolute top-8 right-0 bg-zinc-800 border border-zinc-700 rounded-lg p-2 flex gap-1 shadow-xl z-20 emoji-picker">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(msg.id, emoji)
                    setShowEmojiPicker(false)
                  }}
                  className="p-1.5 rounded hover:bg-zinc-700 transition-colors text-base"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {showContextMenu && !isOwn && (
            <div className="absolute top-8 right-0 bg-zinc-800 border border-zinc-700 rounded-lg py-1 shadow-xl z-20 min-w-[140px] context-menu">
              <button
                onClick={() => {
                  onReport(msg)
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2 transition-colors"
              >
                <Flag size={12} /> Report
              </button>

              <button
                onClick={() => {
                  onMute(msg.userId)
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2 transition-colors"
              >
                <VolumeX size={12} /> Mute
              </button>

              <button
                onClick={() => {
                  onBlock(msg.userId)
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-zinc-700 flex items-center gap-2 transition-colors"
              >
                <Ban size={12} /> Block
              </button>

              {isAdmin && onDelete && (
                <button
                  onClick={() => {
                    onDelete(msg)
                    setShowContextMenu(false)
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-zinc-700 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={12} /> Delete Admin
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TypingIndicator({ names }: { names: string[] }) {
  if (!names.length) return null

  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`

  return (
    <div className="flex items-center gap-2 px-5 py-1.5 text-xs text-zinc-500 typing-indicator">
      <span className="flex gap-0.5">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500" />
        <span
          className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500"
          style={{ animationDelay: '0.15s' }}
        />
        <span
          className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-500"
          style={{ animationDelay: '0.3s' }}
        />
      </span>
      <span>{text}</span>
    </div>
  )
}

export function ReplyPreview({
  msg,
  onCancel,
}: {
  msg: ChatMessageData
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 bg-zinc-900 border-t border-zinc-800 reply-preview">
      <Reply size={14} className="text-purple-400 rotate-180 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-purple-400">{msg.displayName}</span>
        <p className="text-xs text-zinc-400 truncate">{msg.content}</p>
      </div>

      <button
        onClick={onCancel}
        className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
      >
        &times;
      </button>
    </div>
  )
}
