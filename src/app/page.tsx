'use client'

import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface FetchError extends Error {
  info?: { error?: string }
  status?: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error: FetchError = new Error('An error occurred while fetching the data.')
    const info = await res.json() as { error?: string }
    error.info = info
    error.status = res.status
    throw error
  }
  return res.json()
}

interface Stock {
  id: string
  warehouseId: string
  warehouseName: string
  totalUnits: number
  reservedUnits: number
  availableUnits: number
}

interface Product {
  id: string
  name: string
  description: string
  price: string
  stocks: Stock[]
}

export default function ProductsPage() {
  const { data: products, error, isLoading, mutate } = useSWR<Product[]>('/api/products', fetcher)
  const [reservingId, setReservingId] = useState<string | null>(null)
  const router = useRouter()

  const handleReserve = async (productId: string, warehouseId: string, quantity: number = 1) => {
    const stockKey = `${productId}-${warehouseId}`
    setReservingId(stockKey)

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional: 'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ productId, warehouseId, quantity }),
      })

      const result = await response.json() as { id?: string, error?: string }

      if (!response.ok) {
        if (response.status === 409) {
          toast.error('Not enough stock available')
        } else {
          toast.error(result.error || 'Failed to create reservation')
        }
        return
      }

      toast.success('Items reserved successfully!')
      // Refresh local products data to reflect increased reservedUnits
      mutate()
      
      // Navigate to checkout page
      router.push(`/checkout/${result.id}`)
    } catch (err: unknown) {
      console.error(err)
      toast.error('An unexpected error occurred')
    } finally {
      setReservingId(null)
    }
  }

  if (error) return (
    <div className="text-red-500 p-4 bg-red-50 rounded-md border border-red-100">
      <h3 className="font-bold">Error loading products</h3>
      <p className="font-medium">{error.info?.error || error.message}</p>
      {error.info?.details && (
        <pre className="mt-2 text-xs bg-red-100/50 p-2 rounded overflow-auto max-w-full">
          {JSON.stringify(error.info.details, null, 2)}
        </pre>
      )}
    </div>
  )
  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>

  if (!Array.isArray(products)) {
    return <div className="text-amber-600 p-4 bg-amber-50 rounded-md border border-amber-100">
      Invalid data received from server.
    </div>
  }

  return (
    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {products?.map((product) => (
        <Card key={product.id} className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">{product.name}</CardTitle>
                <CardDescription className="line-clamp-2 mt-1">{product.description}</CardDescription>
              </div>
              <span className="text-lg font-bold text-blue-600">${Number(product.price).toFixed(2)}</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <h4 className="text-sm font-semibold mb-3 uppercase tracking-wider text-gray-500">Availability</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-0">Warehouse</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.stocks.map((stock) => (
                  <TableRow key={stock.id}>
                    <TableCell className="font-medium px-0">{stock.warehouseName}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={stock.availableUnits > 0 ? "secondary" : "destructive"}>
                        {stock.availableUnits}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-0">
                      <Button 
                        size="sm" 
                        variant="outline"
                        disabled={stock.availableUnits <= 0 || reservingId === `${product.id}-${stock.warehouseId}`}
                        onClick={() => handleReserve(product.id, stock.warehouseId)}
                      >
                        {reservingId === `${product.id}-${stock.warehouseId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reserve'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {product.stocks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400 py-4 italic">No stock records</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
