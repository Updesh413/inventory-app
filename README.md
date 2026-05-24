# Allo Inventory & Reservation System

This is a real-time inventory management and reservation system built with Next.js, Prisma, PostgreSQL, and Redis. It solves the race condition where multiple customers might try to purchase the last unit of a product simultaneously.

## Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (with Prisma ORM)
- **Concurrency:** Pessimistic Locking (`SELECT ... FOR UPDATE`)
- **Cache/Idempotency:** Upstash Redis
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Validation:** Zod

## Getting Started

### 1. Prerequisites

- Node.js 18+
- A hosted PostgreSQL instance (e.g., Supabase, Neon)
- An Upstash Redis instance

### 2. Environment Variables

Create a `.env` file in the root of the `inventory-app` directory:

```env
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"
```

### 3. Installation

```bash
cd inventory-app
npm install
```

### 4. Database Setup

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Features

### Concurrency Control
To prevent overselling, the `POST /api/reservations` endpoint uses **Database-level Pessimistic Locking**.
Inside a transaction, we use a raw SQL query:
```sql
SELECT * FROM "Stock" WHERE "productId" = $1 AND "warehouseId" = $2 FOR UPDATE
```
This locks the specific stock row for the duration of the transaction, ensuring that concurrent requests for the same SKU are processed sequentially. If stock is insufficient, the transaction rolls back and returns a `409 Conflict`.

### Reservation Expiry
Reservations are held for 10 minutes.
- **Frontend:** A live countdown timer shows remaining time.
- **Backend:** A hybrid approach is used for maximum reliability on Vercel Hobby plans:
    1. **Lazy Cleanup on Read (Primary):** Expired reservations are automatically released whenever stock is listed or a new reservation is attempted. This ensures availability is always accurate at the moment of interaction.
    2. **Daily Cron Job (Secondary):** A background cleanup task runs once per day via Vercel Cron to clean up any abandoned reservations that haven't been touched.
- **Mechanism:** Both methods identify expired `PENDING` reservations and revert the `reservedUnits` in the `Stock` table using transactions.

### Idempotency
Both the reservation creation and confirmation endpoints support an `Idempotency-Key` header.
- We store the result of the first successful request in Redis with a 24-hour TTL.
- Subsequent requests with the same key receive the cached response without re-executing side effects.

## Trade-offs & Future Improvements

1. **Distributed Locking vs DB Locking:** For this exercise, pessimistic DB locking was chosen for its simplicity and strong consistency guarantees within the transaction. In a massive scale global system, a distributed lock (e.g., Redlock) might be preferred to reduce DB load.
2. **Lazy Cleanup:** Currently, we rely on a Cron job. For even higher accuracy, we could implement "lazy cleanup on read" where any fetching of stock levels first checks for and expires old reservations in that specific warehouse.
3. **Analytics:** Adding an audit log table to track every stock movement (IN/OUT/RESERVE/RELEASE) would be essential for a production operations team.
