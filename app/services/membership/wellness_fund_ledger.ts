import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#models/user'
import WellnessFundAccount from '#models/wellness_fund_account'
import WellnessFundLedgerEntry from '#models/wellness_fund_ledger_entry'
import { num, round2 } from '#support/money_helpers'

/**
 * Double-entry style ledger for wellness-fund accounts. Every credit/debit locks
 * the account row, recomputes the running balance, and writes an immutable
 * ledger entry recording the balance_after.
 */
export default class WellnessFundLedger {
  async credit(
    account: WellnessFundAccount,
    amount: number,
    type: string,
    referenceType: string | null = null,
    referenceId: number | null = null,
    description: string | null = null,
    user: User | null = null,
    metadata: Record<string, unknown> = {},
    client?: TransactionClientContract
  ): Promise<WellnessFundLedgerEntry> {
    const run = async (trx: TransactionClientContract): Promise<WellnessFundLedgerEntry> => {
      const locked = await WellnessFundAccount.query({ client: trx })
        .where('id', account.id)
        .forUpdate()
        .firstOrFail()

      const newBalance = round2(num(locked.balance) + amount)

      locked.balance = newBalance
      locked.totalDeposited = round2(num(locked.totalDeposited) + amount)
      locked.status = 'active'
      await locked.save()

      return WellnessFundLedgerEntry.create(
        {
          patientId: locked.patientId,
          wellnessFundAccountId: locked.id,
          type,
          amount,
          balanceAfter: newBalance,
          referenceType,
          referenceId,
          description,
          createdBy: user?.id ?? null,
          metadata: this.encodeMetadata(metadata),
        },
        { client: trx }
      )
    }

    return client ? run(client) : db.transaction(run)
  }

  async debit(
    account: WellnessFundAccount,
    amount: number,
    type: string,
    referenceType: string | null = null,
    referenceId: number | null = null,
    description: string | null = null,
    user: User | null = null,
    metadata: Record<string, unknown> = {},
    client?: TransactionClientContract
  ): Promise<WellnessFundLedgerEntry> {
    const run = async (trx: TransactionClientContract): Promise<WellnessFundLedgerEntry> => {
      const locked = await WellnessFundAccount.query({ client: trx })
        .where('id', account.id)
        .forUpdate()
        .firstOrFail()

      const newBalance = round2(num(locked.balance) - amount)

      locked.balance = newBalance
      if (type === 'refund' && newBalance <= 0) {
        locked.status = 'cancelled'
      } else if (locked.status === 'pending' && newBalance > 0) {
        locked.status = 'active'
      }
      await locked.save()

      return WellnessFundLedgerEntry.create(
        {
          patientId: locked.patientId,
          wellnessFundAccountId: locked.id,
          type,
          amount: -amount,
          balanceAfter: newBalance,
          referenceType,
          referenceId,
          description,
          createdBy: user?.id ?? null,
          metadata: this.encodeMetadata(metadata),
        },
        { client: trx }
      )
    }

    return client ? run(client) : db.transaction(run)
  }

  private encodeMetadata(metadata: Record<string, unknown>): string | null {
    return metadata && Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
  }
}
