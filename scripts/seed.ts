import { db } from '../lib/db'
import { users, paymentMethods } from '../lib/db/schema'
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

  // --- Payment Methods ---
  const husband = await db.query.users.findFirst({ where: eq(users.email, 'jaywapp16@gmail.com') })
  const wife = await db.query.users.findFirst({ where: eq(users.email, 'gpfla8966@gmail.com') })
  if (!husband || !wife) throw new Error('Users not found — run user seed first')

  // Delete all existing payment methods (idempotent)
  await db.delete(paymentMethods)
  console.log('🗑️  Deleted existing payment methods')

  // Insert 8 bank accounts
  const banks = await db.insert(paymentMethods).values([
    { userId: husband.id, name: '우리은행 (급여통장)',       type: 'bank', institution: '우리은행',   owner: 'husband', isShared: false, isHub: false, color: '#0066B3' },
    { userId: husband.id, name: '카카오뱅크 (부부통장)',     type: 'bank', institution: '카카오뱅크', owner: 'joint',   isShared: true,  isHub: true,  color: '#FAE100' },
    { userId: husband.id, name: '하나은행 (용돈통장)',       type: 'bank', institution: '하나은행',   owner: 'husband', isShared: false, isHub: false, color: '#009775' },
    { userId: husband.id, name: '토스뱅크 (생활비)',         type: 'bank', institution: '토스뱅크',   owner: 'joint',   isShared: true,  isHub: false, color: '#0064FF' },
    { userId: husband.id, name: '토스뱅크 (광주통장)',       type: 'bank', institution: '토스뱅크',   owner: 'joint',   isShared: true,  isHub: false, color: '#0064FF' },
    { userId: husband.id, name: '토스뱅크 (영주통장)',       type: 'bank', institution: '토스뱅크',   owner: 'joint',   isShared: true,  isHub: false, color: '#0064FF' },
    { userId: husband.id, name: '토스뱅크 (이나통장)',       type: 'bank', institution: '토스뱅크',   owner: 'joint',   isShared: true,  isHub: false, color: '#0064FF' },
    { userId: husband.id, name: '신한은행 (현대카드 결제)',  type: 'bank', institution: '신한은행',   owner: 'husband', isShared: false, isHub: false, color: '#0046FF' },
  ]).returning()
  console.log(`✅ Inserted ${banks.length} bank accounts`)

  const shinhanBank = banks.find(b => b.institution === '신한은행')
  if (!shinhanBank) throw new Error('신한은행 bank entry not found in inserted results')

  // Insert 3 credit cards
  const cards = await db.insert(paymentMethods).values([
    { userId: husband.id, name: '삼성카드', type: 'credit_card', institution: '삼성카드', owner: 'husband', isShared: false, isHub: false, color: '#1428A0', linkedBankId: null },
    { userId: husband.id, name: '현대카드', type: 'credit_card', institution: '현대카드', owner: 'husband', isShared: false, isHub: false, color: '#000000', linkedBankId: shinhanBank.id },
    { userId: wife.id,    name: '신한카드', type: 'credit_card', institution: '신한카드', owner: 'wife',    isShared: false, isHub: false, color: '#0046FF', linkedBankId: null },
  ]).returning()
  console.log(`✅ Inserted ${cards.length} credit cards`)

  console.log('\n계정 정보:')
  console.log('  남편: jaywapp16@gmail.com / 1234')
  console.log('  아내: gpfla8966@gmail.com / 1234')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
