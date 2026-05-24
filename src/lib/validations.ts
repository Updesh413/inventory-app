import { z } from 'zod'

export const createReservationSchema = z.object({
  productId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  quantity: z.number().int().positive(),
  idempotencyKey: z.string().optional(),
})

export type CreateReservationInput = z.infer<typeof createReservationSchema>

export const confirmReservationSchema = z.object({
  id: z.string().cuid(),
})

export const releaseReservationSchema = z.object({
  id: z.string().cuid(),
})
