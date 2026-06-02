import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

async function seed() {
  const hashed = await bcrypt.hash('1234', 10)

  const familyUsers = [
    { name: '남편', email: 'jaywapp16@gmail.com', hashedPassword: hashed, role: 'husband' as const },
    { name: '아내', email: 'gpfla8966@gmail.com', hashedPassword: hashed, role: 'wife' as const },
  ]

  for (const u of familyUsers) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, u.email) })
    if (existing) {
      await db.update(users).set({ hashedPassword: hashed, name: u.name }).where(eq(users.email, u.email))
      console.log(`✅ Updated: ${u.email}`)
    } else {
      await db.insert(users).values(u)
      console.log(`✅ Created: ${u.email}`)
    }
  }

  console.log('\n계정 정보:')
  console.log('  남편: jaywapp16@gmail.com / 1234')
  console.log('  아내: gpfla8966@gmail.com / 1234')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
