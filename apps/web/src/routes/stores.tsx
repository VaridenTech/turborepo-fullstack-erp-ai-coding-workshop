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

function StoreList() {
  const stores = useQuery(orpc.stores.list.queryOptions({ input: {} }));

  if (stores.isPending) {
    return <p className="text-muted-foreground">กำลังโหลด…</p>;
  }

  if (!stores.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {thaiError(stores.error)}
      </p>
    );
  }

  if (stores.data.items.length === 0) {
    return <p className="text-muted-foreground">ยังไม่มีสาขา</p>;
  }

  return (
    <ul className="divide-y rounded-md border">
      {stores.data.items.map((store) => (
        <li key={store.id} className="flex items-center justify-between px-4 py-3">
          <span className="font-medium">{store.name}</span>
          <span className="text-sm text-muted-foreground">{store.code}</span>
        </li>
      ))}
    </ul>
  );
}

function CreateStoreForm() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const create = useMutation(
    orpc.stores.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.stores.key() });
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
        <Label htmlFor="code">รหัสสาขา</Label>
        <Input id="code" required value={code} onChange={(event) => setCode(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">ชื่อสาขา</Label>
        <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      {create.error && (
        <p role="alert" className="text-sm text-destructive">
          {thaiError(create.error)}
        </p>
      )}
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'กำลังบันทึก…' : 'เพิ่มสาขา'}
      </Button>
    </form>
  );
}

/** Administrator screen to create and list stores (MD-03). */
export function StoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สาขา</h1>
        <p className="text-muted-foreground">จัดการข้อมูลสาขาทั้งหมด</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>เพิ่มสาขาใหม่</CardTitle>
            <CardDescription>กรอกรหัสสาขาและชื่อสาขา</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateStoreForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>รายการสาขา</CardTitle>
            <CardDescription>เรียงจากใหม่ไปเก่า</CardDescription>
          </CardHeader>
          <CardContent>
            <StoreList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
