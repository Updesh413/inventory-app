import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { stock: true }
    })

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    if (reservation.status !== 'PENDING') {
      return NextResponse.json({ error: `Reservation is already ${reservation.status}` }, { status: 400 })
    }

    if (new Date() > new Date(reservation.expiresAt)) {
      return NextResponse.json({ error: 'Reservation has expired' }, { status: 410 })
    }

    // Confirm the reservation
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Update stock levels: decrement both total and reserved
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: {
          totalUnits: { decrement: reservation.quantity },
          reservedUnits: { decrement: reservation.quantity },
        }
      })

      // 2. Update reservation status
      await tx.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' }
      })
    })

    return NextResponse.json({ message: 'Reservation confirmed' })
  } catch (error) {
    console.error('Confirm error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
