import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        stock: {
          include: {
            product: true,
            warehouse: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const stockLevels = await prisma.stock.findMany({
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: [
        { warehouse: { name: 'asc' } },
        { product: { name: 'asc' } }
      ]
    })

    return NextResponse.json({
      reservations,
      auditLogs,
      stockLevels
    })
  } catch (error) {
    console.error('Ops stats error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
