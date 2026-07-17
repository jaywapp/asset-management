import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

/**
 * This application is deployed for one family and has no public sign-up flow.
 * Keep the single-household boundary in one place so it can later be replaced
 * by an explicit household membership table without rewriting every query.
 */
export async function getFamilyUserIds(currentUserId: string): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users)
  const ids = rows.map((row) => row.id)

  return ids.includes(currentUserId) ? ids : [currentUserId]
}
