import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { releaseExpiredReservations } from '@/lib/cleanup'

export async function GET() {
  try {
    // Lazy Cleanup: attempt to release expired units, but don't crash if it fails
    try {
      await releaseExpiredReservations()
    } catch (cleanupError) {
      console.warn('Lazy cleanup failed, proceeding anyway:', cleanupError)
    }

    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
    })

    // Transform to show available stock clearly
    const result = products.map((product) => ({
      ...product,
      stocks: product.stocks.map((stock) => ({
        id: stock.id,
        warehouseId: stock.warehouseId,
        warehouseName: stock.warehouse.name,
        totalUnits: stock.totalUnits,
        reservedUnits: stock.reservedUnits,
        availableUnits: stock.totalUnits - stock.reservedUnits,
      })),
    }))

    return NextResponse.json(result)
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string; code?: string }
    console.error('Detailed Error fetching products:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
    })
    return NextResponse.json({ 
      error: 'Database Connection Error', 
      details: err.message 
    }, { status: 500 })
  }
}
