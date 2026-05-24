import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    // Release the reservation
    await prisma.$transaction(async (tx) => {
      // 1. Update stock levels: only decrement reservedUnits
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: {
          reservedUnits: { decrement: reservation.quantity },
        }
      })

      // 2. Update reservation status
      await tx.reservation.update({
        where: { id },
        data: { status: 'RELEASED' }
      })
    })

    return NextResponse.json({ message: 'Reservation released' })
  } catch (error) {
    console.error('Release error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
