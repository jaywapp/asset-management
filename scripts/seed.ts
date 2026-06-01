import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import bcrypt from 'bcryptjs'

async function seed() {
  const hashed = await bcrypt.hash('password123', 10)
  await db.insert(users).values([
    { name: '남편', email: 'husband@family.com', hashedPassword: hashed, role: 'husband' },
    { name: '아내', email: 'wife@family.com', hashedPassword: hashed, role: 'wife' },
  ]).onConflictDoNothing()
  console.log('✅ Seed complete: husband@family.com / wife@family.com (pw: password123)')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
