import {
  pgTable, pgEnum, text, integer, boolean,
  decimal, timestamp,
} from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const userRoleEnum = pgEnum('user_role', ['husband', 'wife'])
export const accountTypeEnum = pgEnum('account_type', ['stock', 'fund', 'deposit', 'crypto', 'saving'])
export const txTypeEnum = pgEnum('tx_type', ['buy', 'sell', 'dividend', 'deposit', 'withdraw'])
export const incomeCatEnum = pgEnum('income_category', ['salary', 'bonus', 'dividend', 'rental', 'freelance', 'other'])
export const expenseCatEnum = pgEnum('expense_category', ['food', 'transport', 'housing', 'medical', 'education', 'leisure', 'subscription', 'other'])
export const reportTypeEnum = pgEnum('report_type', ['daily', 'weekly', 'monthly', 'on_demand'])
export const paymentMethodTypeEnum = pgEnum('payment_method_type', ['credit_card', 'debit_card', 'bank'])
export const ownerEnum = pgEnum('owner', ['husband', 'wife', 'joint'])
export const transferTypeEnum = pgEnum('transfer_type', ['internal', 'external'])

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  institution: text('institution'),
  currency: text('currency').notNull().default('KRW'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const holdings = pgTable('holdings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  ticker: text('ticker').notNull(),
  name: text('name').notNull(),
  quantity: decimal('quantity', { precision: 18, scale: 8 }).notNull(),
  avgPrice: decimal('avg_price', { precision: 18, scale: 4 }).notNull(),
  currentPrice: decimal('current_price', { precision: 18, scale: 4 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  type: txTypeEnum('type').notNull(),
  ticker: text('ticker'),
  quantity: decimal('quantity', { precision: 18, scale: 8 }),
  price: decimal('price', { precision: 18, scale: 4 }),
  fee: decimal('fee', { precision: 18, scale: 4 }).default('0'),
  date: timestamp('date').notNull(),
  memo: text('memo'),
})

export const realEstate = pgTable('real_estate', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  purchasePrice: decimal('purchase_price', { precision: 18, scale: 0 }).notNull(),
  currentValue: decimal('current_value', { precision: 18, scale: 0 }).notNull(),
  purchaseDate: timestamp('purchase_date').notNull(),
  monthlyRentalIncome: decimal('monthly_rental_income', { precision: 18, scale: 0 }).default('0'),
  propertyTax: decimal('property_tax', { precision: 18, scale: 0 }).default('0'),
})

export const paymentMethods = pgTable('payment_methods', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: paymentMethodTypeEnum('type').notNull(),
  institution: text('institution').notNull(),
  owner: ownerEnum('owner').notNull().default('husband'),
  isShared: boolean('is_shared').notNull().default(false),
  isHub: boolean('is_hub').notNull().default(false),
  accountNumber: text('account_number'),
  color: text('color'),
  linkedBankId: text('linked_bank_id').references((): AnyPgColumn => paymentMethods.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const income = pgTable('income', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: incomeCatEnum('category').notNull(),
  amount: decimal('amount', { precision: 18, scale: 0 }).notNull(),
  description: text('description'),
  date: timestamp('date').notNull(),
  isRecurring: boolean('is_recurring').default(false),
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
})

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: expenseCatEnum('category').notNull(),
  amount: decimal('amount', { precision: 18, scale: 0 }).notNull(),
  description: text('description'),
  date: timestamp('date').notNull(),
  isFixed: boolean('is_fixed').default(false),
  isRecurring: boolean('is_recurring').default(false),
  paymentMethodId: text('payment_method_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
  transferType: transferTypeEnum('transfer_type'),
  transferToId: text('transfer_to_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
})

export const budgets = pgTable('budgets', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: expenseCatEnum('category').notNull(),
  amount: decimal('amount', { precision: 18, scale: 0 }).notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
})

export const aiReports = pgTable('ai_reports', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  type: reportTypeEnum('type').notNull(),
  agent: text('agent').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const agentSettings = pgTable('agent_settings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  agentName: text('agent_name').notNull().unique(),
  systemPrompt: text('system_prompt').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
