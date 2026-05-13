import { pgTable, serial, text, timestamp, integer, json, boolean, unique } from 'drizzle-orm/pg-core'

export const userProfiles = pgTable('user_profiles', {
  id: serial().primaryKey(),
  netlifyId: text('netlify_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  username: text().unique(),
  bio: text().default(''),
  avatarUrl: text('avatar_url').default(''),
  interests: json().$type<string[]>().default([]),
  messageCount: integer('message_count').default(0).notNull(),
  score: integer().default(0).notNull(),
  totalXp: integer('total_xp').default(0).notNull(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastActiveDate: text('last_active_date'),
  lastUsernameChange: timestamp('last_username_change'),
  weeklyMatchOptIn: boolean('weekly_match_opt_in').default(false).notNull(),
  isFounder: boolean('is_founder').default(false).notNull(),
  badgeType: text('badge_type').default('standard').notNull(),
  isPremium: boolean('is_premium').default(false).notNull(),
  premiumSince: timestamp('premium_since'),
  premiumExpires: timestamp('premium_expires'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionTier: text('subscription_tier'),
  isFounderOverride: boolean('is_founder_override').default(false).notNull(),
  bannerUrl: text('banner_url').default(''),
  profileTheme: text('profile_theme').default('default'),
  profileColorPrimary: text('profile_color_primary').default(''),
  profileColorSecondary: text('profile_color_secondary').default(''),
  profileViews: integer('profile_views').default(0).notNull(),
  streakFreezeUsed: integer('streak_freeze_used').default(0).notNull(),
  streakFreezeResetMonth: text('streak_freeze_reset_month'),
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const communityMessages = pgTable('community_messages', {
  id: serial().primaryKey(),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url').default(''),
  content: text().notNull(),
  replyToId: integer('reply_to_id'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const chatRooms = pgTable('chat_rooms', {
  id: serial().primaryKey(),
  name: text().notNull(),
  interest: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const chatMessages = pgTable('chat_messages', {
  id: serial().primaryKey(),
  roomId: integer('room_id').notNull().references(() => chatRooms.id),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url').default(''),
  content: text().notNull(),
  replyToId: integer('reply_to_id'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const userChallenges = pgTable('user_challenges', {
  id: serial().primaryKey(),
  netlifyId: text('netlify_id').notNull(),
  challengeKey: text('challenge_key').notNull(),
  progress: integer().default(0).notNull(),
  completed: boolean().default(false).notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  unique('uq_user_challenge').on(table.netlifyId, table.challengeKey),
])

export const matchGroups = pgTable('match_groups', {
  id: serial().primaryKey(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
})

export const matchGroupMembers = pgTable('match_group_members', {
  id: serial().primaryKey(),
  groupId: integer('group_id').notNull().references(() => matchGroups.id),
  netlifyId: text('netlify_id').notNull(),
})

export const friendships = pgTable('friendships', {
  id: serial().primaryKey(),
  requesterId: text('requester_id').notNull(),
  addresseeId: text('addressee_id').notNull(),
  status: text().notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('uq_friendship').on(table.requesterId, table.addresseeId),
])

export const matchMessages = pgTable('match_messages', {
  id: serial().primaryKey(),
  groupId: integer('group_id').notNull().references(() => matchGroups.id),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url').default(''),
  content: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const messageReactions = pgTable('message_reactions', {
  id: serial().primaryKey(),
  messageType: text('message_type').notNull(),
  messageId: integer('message_id').notNull(),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  emoji: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('uq_reaction').on(table.messageType, table.messageId, table.userId, table.emoji),
])

export const reports = pgTable('reports', {
  id: serial().primaryKey(),
  reporterId: text('reporter_id').notNull(),
  messageType: text('message_type').notNull(),
  messageId: integer('message_id').notNull(),
  reason: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const userBlocks = pgTable('user_blocks', {
  id: serial().primaryKey(),
  blockerId: text('blocker_id').notNull(),
  blockedId: text('blocked_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('uq_block').on(table.blockerId, table.blockedId),
])

export const typingIndicators = pgTable('typing_indicators', {
  id: serial().primaryKey(),
  roomType: text('room_type').notNull(),
  roomId: integer('room_id'),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const directMessages = pgTable('direct_messages', {
  id: serial().primaryKey(),
  senderId: text('sender_id').notNull(),
  receiverId: text('receiver_id').notNull(),
  senderDisplayName: text('sender_display_name').notNull(),
  senderAvatarUrl: text('sender_avatar_url').default(''),
  content: text().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const follows = pgTable('follows', {
  id: serial().primaryKey(),
  followerId: text('follower_id').notNull(),
  followingId: text('following_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  unique('uq_follow').on(table.followerId, table.followingId),
])

export const profileViewLog = pgTable('profile_view_log', {
  id: serial().primaryKey(),
  profileOwnerId: text('profile_owner_id').notNull(),
  viewerId: text('viewer_id').notNull(),
  viewedAt: timestamp('viewed_at').defaultNow(),
})

export const termsAcceptances = pgTable('terms_acceptances', {
  id: serial().primaryKey(),
  netlifyId: text('netlify_id').notNull(),
  termsAccepted: boolean('terms_accepted').default(false).notNull(),
  termsAcceptedDate: timestamp('terms_accepted_date').defaultNow(),
  subscriptionDisclosureAccepted: boolean('subscription_disclosure_accepted').default(false).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const userBans = pgTable('user_bans', {
  id: serial().primaryKey(),
  netlifyId: text('netlify_id').notNull(),
  reason: text().default(''),
  permanent: boolean().default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  bannedBy: text('banned_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial().primaryKey(),
  adminId: text('admin_id').notNull(),
  action: text().notNull(),
  targetUserId: text('target_user_id'),
  targetMessageId: integer('target_message_id'),
  messageType: text('message_type'),
  details: text(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const dmReadCursors = pgTable('dm_read_cursors', {
  id: serial().primaryKey(),
  userId: text('user_id').notNull(),
  partnerId: text('partner_id').notNull(),
  lastReadMessageId: integer('last_read_message_id').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  unique('uq_dm_read_cursor').on(table.userId, table.partnerId),
])

export const mentions = pgTable('mentions', {
  id: serial().primaryKey(),
  mentionedUserId: text('mentioned_user_id').notNull(),
  mentionerUserId: text('mentioner_user_id').notNull(),
  mentionerDisplayName: text('mentioner_display_name').notNull(),
  messageType: text('message_type').notNull(),
  messageId: integer('message_id').notNull(),
  roomId: integer('room_id'),
  content: text().notNull(),
  read: boolean().default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const premiumMessages = pgTable('premium_messages', {
  id: serial().primaryKey(),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url').default(''),
  content: text().notNull(),
  replyToId: integer('reply_to_id'),
  createdAt: timestamp('created_at').defaultNow(),
})
