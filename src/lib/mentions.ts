import { db } from '../../db/index.js'
import { userProfiles, mentions } from '../../db/schema.js'
import { eq, inArray } from 'drizzle-orm'

const MENTION_REGEX = /@(\w[\w.-]{0,29})/g

export async function extractAndSaveMentions(
  content: string,
  senderUserId: string,
  senderDisplayName: string,
  messageType: string,
  messageId: number,
  roomId?: number | null,
) {
  const usernames: string[] = []
  let match: RegExpExecArray | null
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const username = match[1].toLowerCase()
    if (!usernames.includes(username)) usernames.push(username)
  }
  if (!usernames.length) return

  const profiles = await db
    .select({ netlifyId: userProfiles.netlifyId, username: userProfiles.username })
    .from(userProfiles)
    .where(inArray(userProfiles.username, usernames))

  const toInsert = profiles
    .filter((p) => p.netlifyId !== senderUserId)
    .map((p) => ({
      mentionedUserId: p.netlifyId,
      mentionerUserId: senderUserId,
      mentionerDisplayName: senderDisplayName,
      messageType,
      messageId,
      roomId: roomId ?? null,
      content: content.slice(0, 200),
    }))

  if (toInsert.length) {
    await db.insert(mentions).values(toInsert)
  }
}
