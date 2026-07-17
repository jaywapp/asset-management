import bcrypt from 'bcryptjs'
import { inArray, eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { paymentMethods, users } from '../lib/db/schema'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

async function seed() {
  const familyUsers = [
    {
      name: process.env.SEED_HUSBAND_NAME?.trim() || '남편',
      email: requireEnv('SEED_HUSBAND_EMAIL'),
      password: requireEnv('SEED_HUSBAND_PASSWORD'),
      role: 'husband' as const,
    },
    {
      name: process.env.SEED_WIFE_NAME?.trim() || '아내',
      email: requireEnv('SEED_WIFE_EMAIL'),
      password: requireEnv('SEED_WIFE_PASSWORD'),
      role: 'wife' as const,
    },
  ]

  if (familyUsers.some((user) => user.password.length < 8
    || !/[A-Za-z]/.test(user.password)
    || !/\d/.test(user.password))) {
    throw new Error('Seed passwords must be at least 8 characters and include letters and numbers')
  }

  for (const user of familyUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 12)
    const existing = await db.query.users.findFirst({ where: eq(users.email, user.email) })
    if (existing) {
      await db.update(users)
        .set({ hashedPassword, name: user.name, role: user.role })
        .where(eq(users.id, existing.id))
    } else {
      await db.insert(users).values({
        name: user.name,
        email: user.email,
        hashedPassword,
        role: user.role,
      })
    }
  }

  const seededUsers = await db.select({ id: users.id, role: users.role })
    .from(users)
    .where(inArray(users.email, familyUsers.map((user) => user.email)))
  const husband = seededUsers.find((user) => user.role === 'husband')
  const wife = seededUsers.find((user) => user.role === 'wife')
  if (!husband || !wife) throw new Error('Seed users could not be loaded')

  const existingMethods = await db.select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(inArray(paymentMethods.userId, [husband.id, wife.id]))
    .limit(1)
  if (existingMethods.length > 0) {
    console.log('Seed users updated; existing payment methods were preserved')
    return
  }

  const [sharedBank] = await db.insert(paymentMethods).values({
    userId: husband.id,
    name: '공동 생활비 통장',
    type: 'bank',
    institution: '은행',
    owner: 'joint',
    isShared: true,
    isHub: true,
    color: '#2563EB',
  }).returning()

  await db.insert(paymentMethods).values([
    {
      userId: husband.id,
      name: '남편 주거래 통장',
      type: 'bank',
      institution: '은행',
      owner: 'husband',
      color: '#0F766E',
    },
    {
      userId: wife.id,
      name: '아내 주거래 통장',
      type: 'bank',
      institution: '은행',
      owner: 'wife',
      color: '#7C3AED',
    },
    {
      userId: husband.id,
      name: '생활비 카드',
      type: 'credit_card',
      institution: '카드사',
      owner: 'joint',
      isShared: true,
      color: '#111827',
      linkedBankId: sharedBank.id,
      includeInNetWorth: false,
    },
  ])

  console.log('Seed completed without exposing credentials or replacing existing financial data')
}

seed().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Seed failed')
  process.exitCode = 1
})
