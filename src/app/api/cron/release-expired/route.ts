import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET() {
  // Optional: Add authorization check for CRON_SECRET if deploying to Vercel
  // const authHeader = req.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response('Unauthorized', { status: 401 });
  // }

  try {
    const now = new Date()

    // Find expired pending reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now
        }
      }
    })

    if (expiredReservations.length === 0) {
      return NextResponse.json({ message: 'No expired reservations found' })
    }

    let releasedCount = 0

    // Use a transaction to ensure all updates are consistent
    // For large numbers, this might need chunking, but for a take-home, 
    // a single transaction is likely fine.
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const res of expiredReservations) {
        // 1. Revert reserved units in Stock
        await tx.stock.update({
          where: { id: res.stockId },
          data: {
            reservedUnits: { decrement: res.quantity }
          }
        })

        // 2. Mark as RELEASED
        await tx.reservation.update({
          where: { id: res.id },
          data: {
            status: 'RELEASED'
          }
        })

        // 3. Audit Log
        await tx.auditLog.create({
          data: {
            action: 'EXPIRE',
            reservationId: res.id,
            productId: null, // We'd need to join to get this, but stockId is enough
            warehouseId: null,
            quantity: res.quantity,
            details: JSON.stringify({ stockId: res.stockId, reason: 'CRON_AUTO_EXPIRE' })
          }
        })
        
        releasedCount++
      }
    })

    return NextResponse.json({ 
      message: `Successfully released ${releasedCount} expired reservations`,
      ids: expiredReservations.map(r => r.id)
    })

  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
