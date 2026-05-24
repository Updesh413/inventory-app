'use client'

import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Timer, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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

interface ReservationDetails {
  id: string
  quantity: number
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED'
  expiresAt: string
  stock: {
    product: {
      name: string
      price: string
    }
    warehouse: {
      name: string
    }
  }
}

export default function CheckoutPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  
  const { data: reservation, error, isLoading, mutate } = useSWR<ReservationDetails>(
    id ? `/api/reservations/${id}` : null, 
    fetcher,
    { refreshInterval: 5000 } // Refresh every 5s to check status
  )

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!reservation || reservation.status !== 'PENDING') {
      const timeout = setTimeout(() => {
        setTimeLeft(null)
      }, 0)
      return () => clearTimeout(timeout)
    }

    const calculateTimeLeft = () => {
      const difference = new Date(reservation.expiresAt).getTime() - new Date().getTime()
      return Math.max(0, Math.floor(difference / 1000))
    }

    // Set initial time left asynchronously to avoid synchronous render warning
    const timeout = setTimeout(() => {
      setTimeLeft(calculateTimeLeft())
    }, 0)

    const timer = setInterval(() => {
      const left = calculateTimeLeft()
      setTimeLeft(left)
      if (left <= 0) {
        clearInterval(timer)
        mutate()
      }
    }, 1000)

    return () => {
      clearTimeout(timeout)
      clearInterval(timer)
    }
  }, [reservation, mutate])

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, { method: 'POST' })
      const data = await res.json() as { error?: string }

      if (!res.ok) {
        if (res.status === 410) {
          toast.error('This reservation has expired.')
        } else {
          toast.error(data.error || 'Failed to confirm purchase')
        }
        mutate()
        return
      }

      toast.success('Purchase confirmed successfully!')
      mutate()
    } catch (err: unknown) {
      console.error(err)
      toast.error('An unexpected error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/reservations/${id}/release`, { method: 'POST' })
      const data = await res.json() as { error?: string }

      if (!res.ok) {
        toast.error(data.error || 'Failed to cancel reservation')
        mutate()
        return
      }

      toast.info('Reservation cancelled.')
      mutate()
      router.push('/')
    } catch (err: unknown) {
      console.error(err)
      toast.error('An unexpected error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-blue-500" /></div>
  if (error || !reservation) return <div className="text-center p-12 text-red-500">Reservation not found. <Link href="/" className="underline ml-2">Back to products</Link></div>

  const isExpired = timeLeft === 0 && reservation.status === 'PENDING'
  const canAct = reservation.status === 'PENDING' && !isExpired

  return (
    <div className="max-w-xl mx-auto">
      <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
      </Link>

      <Card className="shadow-lg border-t-4 border-t-blue-500">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl">Complete Your Purchase</CardTitle>
            <Badge variant={
              reservation.status === 'CONFIRMED' ? 'default' : 
              reservation.status === 'RELEASED' ? 'destructive' : 
              isExpired ? 'destructive' : 'secondary'
            }>
              {reservation.status === 'PENDING' && isExpired ? 'EXPIRED' : reservation.status}
            </Badge>
          </div>
          <CardDescription>Review your reservation details and confirm payment.</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 flex items-center justify-between">
            <div className="flex items-center text-blue-700 font-medium">
              <Timer className="mr-2 h-5 w-5" />
              {reservation.status === 'PENDING' ? 'Time Remaining' : 'Status Info'}
            </div>
            <div className={`text-2xl font-mono font-bold ${timeLeft !== null && timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-blue-900'}`}>
              {reservation.status === 'PENDING' ? (timeLeft !== null ? formatTime(timeLeft) : '--:--') : reservation.status}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Product</p>
              <p className="text-lg font-semibold">{reservation.stock.product.name}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Warehouse</p>
              <p className="text-lg font-semibold">{reservation.stock.warehouse.name}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Quantity</p>
              <p className="text-lg font-semibold">{reservation.quantity} unit{reservation.quantity > 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Total Price</p>
              <p className="text-lg font-semibold text-blue-600">
                ${(Number(reservation.stock.product.price) * reservation.quantity).toFixed(2)}
              </p>
            </div>
          </div>

          {reservation.status === 'CONFIRMED' && (
            <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              <CheckCircle2 className="mr-3 h-6 w-6 text-green-500" />
              <div>
                <p className="font-bold">Payment Successful!</p>
                <p className="text-sm">Your order has been confirmed and inventory has been updated.</p>
              </div>
            </div>
          )}

          {(reservation.status === 'RELEASED' || isExpired) && (
            <div className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              <XCircle className="mr-3 h-6 w-6 text-red-500" />
              <div>
                <p className="font-bold">Reservation Unavailable</p>
                <p className="text-sm">This reservation has been released. Please return to the product page to try again.</p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-3 justify-end border-t pt-6 bg-gray-50/50 rounded-b-xl">
          {canAct ? (
            <>
              <Button variant="ghost" onClick={handleCancel} disabled={isProcessing}>
                Cancel
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleConfirm} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm Purchase
              </Button>
            </>
          ) : (
            <Button asChild className="w-full">
              <Link href="/">Return to Products</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
