import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import redis from '@/lib/redis'
import { createReservationSchema } from '@/lib/validations'
import { type ReservationStatus } from '@prisma/client'
import { releaseExpiredReservations } from '@/lib/cleanup'

const RESERVATION_EXPIRY_MINUTES = 10

export async function POST(req: NextRequest) {
  try {
    // Lazy Cleanup: release any expired units before checking availability
    await releaseExpiredReservations()

    const body = await req.json()
    const validated = createReservationSchema.safeParse(body)
    
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid input', details: validated.error.format() }, { status: 400 })
    }

    const { productId, warehouseId, quantity } = validated.data
    const idempotencyKey = req.headers.get('Idempotency-Key') || validated.data.idempotencyKey

    // 1. Idempotency Check
    if (idempotencyKey) {
      const cached = await redis.get(`idempotency:reservation:${idempotencyKey}`)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    // 2. Database Transaction with Pessimistic Locking
    const result = await prisma.$transaction(async (tx) => {
      // Find the stock record and lock it for update
      // Prisma queryRaw is needed for FOR UPDATE
      const stocks = await tx.$queryRaw<any[]>`
        SELECT * FROM "Stock" 
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

      return reservation
    })

    // 3. Cache result for idempotency
    if (idempotencyKey) {
      await redis.set(`idempotency:reservation:${idempotencyKey}`, result, { ex: 60 * 60 * 24 }) // 24h
    }

    return NextResponse.json(result, { status: 201 })

  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_STOCK') {
      return NextResponse.json({ error: 'Not enough stock available' }, { status: 409 })
    }
    if (error.message === 'STOCK_NOT_FOUND') {
      return NextResponse.json({ error: 'Stock record not found' }, { status: 404 })
    }
    
    // Handle Prisma unique constraint error for idempotencyKey if redis check failed/was bypassed
    if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
       // Try to fetch existing reservation if idempotency key conflict occurs
       const existing = await prisma.reservation.findUnique({
         where: { idempotencyKey: error.meta.target.value } // This is pseudo-code for finding the actual key
       })
       if (existing) return NextResponse.json(existing);
    }

    console.error('Reservation error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
