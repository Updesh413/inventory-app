import prisma from './prisma'
import type { Prisma } from '@prisma/client'

/**
 * Automatically releases any pending reservations that have passed their expiry time.
 * This can be used as "Lazy Cleanup" before reading stock levels or creating new reservations.
 */
export async function releaseExpiredReservations() {
  const now = new Date()

  // 1. Find all expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now }
    }
  })

  if (expired.length === 0) return 0

  // 2. Process in a transaction to ensure stock levels are corrected
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const res of expired) {
      await tx.stock.update({
        where: { id: res.stockId },
        data: {
          reservedUnits: { decrement: res.quantity }
        }
      })

      await tx.reservation.update({
        where: { id: res.id },
        data: { status: 'RELEASED' }
      })

      await tx.auditLog.create({
        data: {
          action: 'EXPIRE',
          reservationId: res.id,
          quantity: res.quantity,
          details: JSON.stringify({ stockId: res.stockId, reason: 'LAZY_AUTO_EXPIRE' })
        }
      })
    }
  })

  return expired.length
}
