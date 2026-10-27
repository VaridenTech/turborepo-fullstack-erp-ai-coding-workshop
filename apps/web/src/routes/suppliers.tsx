import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ErrorEnvelope } from '@erp/contracts';
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

function SupplierList() {
  const suppliers = useQuery(orpc.suppliers.list.queryOptions({ input: {} }));

  if (suppliers.isPending) {
    return <p className="text-muted-foreground">กำลังโหลด…</p>;
  }

  if (!suppliers.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {thaiError(suppliers.error)}
      </p>
    );
  }

  if (suppliers.data.items.length === 0) {
    return <p className="text-muted-foreground">ยังไม่มีผู้ขาย</p>;
  }

  return (
    <ul className="divide-y rounded-md border">
      {suppliers.data.items.map((supplier) => (
        <li key={supplier.id} className="flex items-center justify-between px-4 py-3">
          <span className="font-medium">{supplier.name}</span>
          <span className="text-sm text-muted-foreground">{supplier.code}</span>
        </li>
      ))}
    </ul>
  );
}

function CreateSupplierForm() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const create = useMutation(
    orpc.suppliers.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.suppliers.key() });
        setCode('');
        setName('');
      },
    }),
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ code, name });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="code">รหัสผู้ขาย</Label>
        <Input id="code" required value={code} onChange={(event) => setCode(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">ชื่อผู้ขาย</Label>
        <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {thaiError(create.error)}
        </p>
      )}
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'กำลังบันทึก…' : 'เพิ่มผู้ขาย'}
      </Button>
    </form>
  );
}

/** Administrator screen to create and list suppliers (MD-03). */
export function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ผู้ขาย</h1>
        <p className="text-muted-foreground">จัดการข้อมูลผู้ขายทั้งหมด</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>เพิ่มผู้ขายใหม่</CardTitle>
            <CardDescription>กรอกรหัสผู้ขายและชื่อผู้ขาย</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateSupplierForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>รายการผู้ขาย</CardTitle>
            <CardDescription>เรียงจากใหม่ไปเก่า</CardDescription>
          </CardHeader>
          <CardContent>
            <SupplierList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
