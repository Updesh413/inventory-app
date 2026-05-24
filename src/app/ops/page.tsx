'use client'

import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Timer, History, Package, Activity } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface OpsData {
  reservations: any[]
  auditLogs: any[]
  stockLevels: any[]
}

export default function OpsDashboard() {
  const { data, error, isLoading } = useSWR<OpsData>('/api/ops/stats', fetcher, { refreshInterval: 5000 })

  if (error) return <div className="text-red-500">Failed to load operations data</div>

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Ops Dashboard</h2>
          <p className="text-muted-foreground">Real-time inventory and reservation monitoring.</p>
        </div>
        <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 animate-pulse">
          <Activity className="mr-1 h-3 w-3" /> Live Updates
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Holds</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : data?.reservations.filter(r => r.status === 'PENDING').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : [...new Set(data?.stockLevels.map(s => s.productId))].length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stock">Current Stock</TabsTrigger>
          <TabsTrigger value="reservations">Recent Reservations</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4">
          <Card shadow-sm>
            <CardHeader>
              <CardTitle>Inventory Levels</CardTitle>
              <CardDescription>Stock status across all warehouses.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1,2,3].map(i => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
                  ) : data?.stockLevels.map((stock) => (
                    <TableRow key={stock.id}>
                      <TableCell className="font-medium">{stock.warehouse.name}</TableCell>
                      <TableCell>{stock.product.name}</TableCell>
                      <TableCell className="text-right">{stock.totalUnits}</TableCell>
                      <TableCell className="text-right text-amber-600">{stock.reservedUnits}</TableCell>
                      <TableCell className="text-right font-bold">{stock.totalUnits - stock.reservedUnits}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Reservations</CardTitle>
              <CardDescription>The last 50 reservation attempts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1,2,3].map(i => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
                  ) : data?.reservations.map((res) => (
                    <TableRow key={res.id}>
                      <TableCell className="font-mono text-[10px]">{res.id}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{res.stock.product.name}</TableCell>
                      <TableCell>
                        <Badge variant={res.status === 'CONFIRMED' ? 'default' : res.status === 'RELEASED' ? 'destructive' : 'secondary'}>
                          {res.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{res.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(res.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card shadow-sm>
            <CardHeader>
              <CardTitle>System Audit Log</CardTitle>
              <CardDescription>Immutable record of all stock and reservation state changes.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Reservation ID</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1,2,3].map(i => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)
                  ) : data?.auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{new Date(log.createdAt).toLocaleTimeString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">{log.reservationId || '-'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[300px] truncate">
                        {log.details}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
