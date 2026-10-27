import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/components/require-auth';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { HomePage } from './home';
import { ProductsPage } from './products';
import { RootLayout } from './root-layout';

const water = {
  id: 'p1',
  sku: 'SKU001',
  name: 'น้ำดื่มแพ็ค 6',
  category: 'เครื่องดื่ม',
  unit: 'แพ็ค',
  sellingPrice: '60.00',
  isActive: true,
  reorderThresholds: [{ storeId: 'b01', threshold: 3 }],
  createdAt: new Date('2026-01-02T00:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-01-02T00:00:00.000Z').toISOString(),
};

const admin = {
  id: '1',
  email: 'administrator@erp.local',
  name: 'Administrator',
  role: 'ADMINISTRATOR',
  storeId: null,
};
const staff = {
  id: '2',
  email: 'staff_b01@erp.local',
  name: 'Staff B01',
  role: 'STORE_EMPLOYEE',
  storeId: 's1',
};

function renderApp(url = '/') {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            element: <RootLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'products', element: <ProductsPage /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [url] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function renderProducts() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ProductsPage />
    </QueryClientProvider>,
  );
}

/** oRPC JSON error body carrying the shared Thai error envelope in `data`. */
function envelope(code: string, message: string, fields: string[], status = 409) {
  return Response.json(
    { defined: false, code, status, message, data: { code, message, fields } },
    { status },
  );
}

describe('ProductsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state while the list is pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    renderProducts();

    expect(screen.getByText('กำลังโหลด…')).toBeInTheDocument();
  });

  it('renders products from the API with the two-decimal price', async () => {
    mockApi({ 'GET /products': { items: [water], total: 1, page: 1, pageSize: 20 } });

    renderProducts();

    expect(await screen.findByText('น้ำดื่มแพ็ค 6')).toBeInTheDocument();
    expect(screen.getByText('SKU001')).toBeInTheDocument();
    expect(screen.getByText('60.00')).toBeInTheDocument();
  });

  it('shows an empty state when there are no products', async () => {
    mockApi({ 'GET /products': { items: [], total: 0, page: 1, pageSize: 20 } });

    renderProducts();

    expect(await screen.findByText('ยังไม่มีสินค้า')).toBeInTheDocument();
  });

  it('marks an inactive product as deactivated in the list (MD-02)', async () => {
    mockApi({
      'GET /products': {
        items: [{ ...water, isActive: false }],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });

    renderProducts();

    expect(await screen.findByText('ปิดการใช้งาน')).toBeInTheDocument();
  });

  it('surfaces the Thai error envelope when a duplicate SKU is submitted', async () => {
    mockApi({
      'GET /products': { items: [water], total: 1, page: 1, pageSize: 20 },
      'POST /products': envelope('CONFLICT', 'รหัสสินค้านี้ถูกใช้แล้ว', ['sku']),
    });

    renderProducts();

    fireEvent.change(await screen.findByLabelText('รหัสสินค้า (SKU)'), {
      target: { value: 'SKU001' },
    });
    fireEvent.change(screen.getByLabelText('ชื่อสินค้า'), { target: { value: 'น้ำดื่ม' } });
    fireEvent.change(screen.getByLabelText('หมวดหมู่'), { target: { value: 'เครื่องดื่ม' } });
    fireEvent.change(screen.getByLabelText('หน่วย'), { target: { value: 'แพ็ค' } });
    fireEvent.change(screen.getByLabelText('ราคาขาย'), { target: { value: '60.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสินค้า' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('รหัสสินค้านี้ถูกใช้แล้ว');
  });
});

describe('Products navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets an Administrator reach the products screen from the navigation', async () => {
    mockApi({
      'GET /auth/me': { user: admin },
      'GET /products': { items: [water], total: 1, page: 1, pageSize: 20 },
    });

    renderApp('/');

    fireEvent.click(await screen.findByRole('link', { name: 'สินค้า' }));

    expect(await screen.findByRole('heading', { name: 'สินค้า' })).toBeInTheDocument();
    expect(await screen.findByText('น้ำดื่มแพ็ค 6')).toBeInTheDocument();
  });

  it('hides the products link from a non-Administrator', async () => {
    mockApi({ 'GET /auth/me': { user: staff } });

    renderApp('/');

    expect(await screen.findByText('Welcome 👋')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'สินค้า' })).not.toBeInTheDocument();
  });
});
