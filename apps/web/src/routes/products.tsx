import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ErrorEnvelope } from '@erp/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { orpc } from '@/lib/orpc';

/** The Thai message from the shared error envelope, with a safe Thai fallback. */
function thaiError(error: unknown): string {
  if (error instanceof ORPCError) {
    const data = error.data as ErrorEnvelope | undefined;
    if (data?.message) return data.message;
  }
  return 'เกิดข้อผิดพลาด ไม่สามารถดำเนินการได้';
}

function ProductList() {
  const queryClient = useQueryClient();
  const products = useQuery(orpc.products.list.queryOptions({ input: { includeInactive: true } }));

  const setActive = useMutation(
    orpc.products.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.products.key() });
      },
    }),
  );

  if (products.isPending) {
    return <p className="text-muted-foreground">กำลังโหลด…</p>;
  }

  if (!products.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {thaiError(products.error)}
      </p>
    );
  }

  if (products.data.items.length === 0) {
    return <p className="text-muted-foreground">ยังไม่มีสินค้า</p>;
  }

  return (
    <ul className="divide-y rounded-md border">
      {products.data.items.map((product) => (
        <li key={product.id} className="flex items-center justify-between px-4 py-3">
          <div className="flex flex-col">
            <span className="font-medium">{product.name}</span>
            <span className="text-sm text-muted-foreground">{product.sku}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm tabular-nums">{product.sellingPrice}</span>
            {!product.isActive && <Badge variant="secondary">ปิดการใช้งาน</Badge>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={setActive.isPending}
              aria-label={`${product.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'} ${product.sku}`}
              onClick={() =>
                setActive.mutate({
                  id: product.id,
                  name: product.name,
                  category: product.category,
                  unit: product.unit,
                  sellingPrice: product.sellingPrice,
                  isActive: !product.isActive,
                  reorderThresholds: product.reorderThresholds,
                })
              }
            >
              {product.isActive ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CreateProductForm() {
  const queryClient = useQueryClient();
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  const create = useMutation(
    orpc.products.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.products.key() });
        setSku('');
        setName('');
        setCategory('');
        setUnit('');
        setSellingPrice('');
      },
    }),
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ sku, name, category, unit, sellingPrice });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="sku">รหัสสินค้า (SKU)</Label>
        <Input id="sku" required value={sku} onChange={(event) => setSku(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">ชื่อสินค้า</Label>
        <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">หมวดหมู่</Label>
        <Input
          id="category"
          required
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unit">หน่วย</Label>
        <Input id="unit" required value={unit} onChange={(event) => setUnit(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sellingPrice">ราคาขาย</Label>
        <Input
          id="sellingPrice"
          required
          inputMode="decimal"
          placeholder="0.00"
          value={sellingPrice}
          onChange={(event) => setSellingPrice(event.target.value)}
        />
      </div>
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {thaiError(create.error)}
        </p>
      )}
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'กำลังบันทึก…' : 'เพิ่มสินค้า'}
      </Button>
    </form>
  );
}

/** Administrator screen to create and list products (MD-01, MD-02). */
export function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สินค้า</h1>
        <p className="text-muted-foreground">จัดการข้อมูลสินค้าทั้งหมด</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>เพิ่มสินค้าใหม่</CardTitle>
            <CardDescription>กรอกรหัสสินค้า ชื่อ หมวดหมู่ หน่วย และราคาขาย</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateProductForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>รายการสินค้า</CardTitle>
            <CardDescription>เรียงจากใหม่ไปเก่า รวมสินค้าที่ปิดการใช้งาน</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
