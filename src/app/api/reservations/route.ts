import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import redis from '@/lib/redis'
import { createReservationSchema } from '@/lib/validations'
import { releaseExpiredReservations } from '@/lib/cleanup'

const RESERVATION_EXPIRY_MINUTES = 10

interface RawStock {
  id: string
  totalUnits: number
  reservedUnits: number
}

export async function POST(req: NextRequest) {
  let idempotencyKey: string | null = null
  try {
    // Lazy Cleanup: release any expired units before checking availability
    await releaseExpiredReservations()

    const body = await req.json()
    const validated = createReservationSchema.safeParse(body)
    
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid input', details: validated.error.format() }, { status: 400 })
    }

    const { productId, warehouseId, quantity } = validated.data
    idempotencyKey = req.headers.get('Idempotency-Key') || validated.data.idempotencyKey || null

    // 1. Idempotency Check
    if (idempotencyKey) {
      const cached = await redis.get(`idempotency:reservation:${idempotencyKey}`)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    // 2. Database Transaction with Pessimistic Locking
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find the stock record and lock it for update
      // Prisma queryRaw is needed for FOR UPDATE
      const stocks = await tx.$queryRaw<RawStock[]>`
        SELECT id, "totalUnits", "reservedUnits" FROM "Stock" 
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId} 
        LIMIT 1 
        FOR UPDATE
      `

      if (stocks.length === 0) {
        throw new Error('STOCK_NOT_FOUND')
      }

      const stock = stocks[0]
      const available = stock.totalUnits - stock.reservedUnits

      if (available < quantity) {
        throw new Error('INSUFFICIENT_STOCK')
      }

      // Update reserved units
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          reservedUnits: {
            increment: quantity
          }
        }
      })

      // Create reservation
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + RESERVATION_EXPIRY_MINUTES)

      const reservation = await tx.reservation.create({
        data: {
          stockId: stock.id,
          quantity,
          status: 'PENDING',
          expiresAt,
          idempotencyKey: idempotencyKey || null,
        }
      })

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          action: 'RESERVE',
          reservationId: reservation.id,
          productId,
          warehouseId,
          quantity,
          details: JSON.stringify({ stockId: stock.id, expiresAt })
        }
      })

      return reservation
    })

    // 3. Cache result for idempotency
    if (idempotencyKey) {
      await redis.set(`idempotency:reservation:${idempotencyKey}`, result, { ex: 60 * 60 * 24 }) // 24h
    }

    return NextResponse.json(result, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'INSUFFICIENT_STOCK') {
        return NextResponse.json({ error: 'Not enough stock available' }, { status: 409 })
      }
      if (error.message === 'STOCK_NOT_FOUND') {
        return NextResponse.json({ error: 'Stock record not found' }, { status: 404 })
      }
    }
    
    // Handle Prisma unique constraint error for idempotencyKey
    const prismaError = error as { code?: string; meta?: { target?: string[] } }
    if (prismaError.code === 'P2002' && prismaError.meta?.target?.includes('idempotencyKey')) {
       const existing = await prisma.reservation.findUnique({
         where: { idempotencyKey: idempotencyKey as string }
       })
       if (existing) return NextResponse.json(existing);
    }

    console.error('Reservation error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
