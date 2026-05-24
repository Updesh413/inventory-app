const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const pg = require('pg')

const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. Clear existing data
  await prisma.reservation.deleteMany({})
  await prisma.stock.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.warehouse.deleteMany({})

  console.log('Cleared existing data.')

  // 2. Create Warehouses
  const wh1 = await prisma.warehouse.create({
    data: { name: 'Mumbai North', location: 'Maharashtra' },
  })
  const wh2 = await prisma.warehouse.create({
    data: { name: 'Bangalore East', location: 'Karnataka' },
  })
  const wh3 = await prisma.warehouse.create({
    data: { name: 'Delhi Central', location: 'NCR' },
  })

  console.log('Created warehouses.')

  // 3. Create Products
  const p1 = await prisma.product.create({
    data: {
      name: 'Wireless Headphones',
      description: 'Noise cancelling over-ear headphones with 40h battery life.',
      price: 199.99,
    },
  })
  const p2 = await prisma.product.create({
    data: {
      name: 'Smart Watch',
      description: 'Fitness tracker with heart rate monitor and GPS.',
      price: 249.50,
    },
  })
  const p3 = await prisma.product.create({
    data: {
      name: 'Mechanical Keyboard',
      description: 'RGB backlit keyboard with tactile switches.',
      price: 120.00,
    },
  })

  console.log('Created products.')

  // 4. Create Stocks
  await prisma.stock.createMany({
    data: [
      { productId: p1.id, warehouseId: wh1.id, totalUnits: 50 },
      { productId: p1.id, warehouseId: wh2.id, totalUnits: 30 },
      { productId: p2.id, warehouseId: wh2.id, totalUnits: 25 },
      { productId: p2.id, warehouseId: wh3.id, totalUnits: 15 },
      { productId: p3.id, warehouseId: wh1.id, totalUnits: 10 },
      { productId: p3.id, warehouseId: wh3.id, totalUnits: 40 },
    ],
  })

  console.log('Seeded initial stock levels.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
