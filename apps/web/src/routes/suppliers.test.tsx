import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/components/require-auth';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { HomePage } from './home';
import { RootLayout } from './root-layout';
import { SuppliersPage } from './suppliers';

const supplyOne = {
  id: 'sup1',
  code: 'SUP01',
  name: 'SupplyOne Co Ltd',
  contactPerson: null,
  phone: null,
  email: null,
  address: null,
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

/** The real route tree (RequireAuth > RootLayout > pages) driven by a memory router. */
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
              { path: 'suppliers', element: <SuppliersPage /> },
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

function renderSuppliers() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SuppliersPage />
    </QueryClientProvider>,
  );
}

/** oRPC JSON error body carrying the shared Thai error envelope in `data`. */
function envelope(code: string, message: string, fields: string[], status = 409) {
  return Response.json(
    { defined: false, code, status, message, data: { code: 'SUPPLIER_CODE_TAKEN', message, fields } },
    { status },
  );
}

describe('SuppliersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state while the list is pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    renderSuppliers();

    expect(screen.getByText('กำลังโหลด…')).toBeInTheDocument();
  });

  it('renders suppliers from the API', async () => {
    mockApi({ 'GET /suppliers': { items: [supplyOne], total: 1, page: 1, pageSize: 20 } });

    renderSuppliers();

    expect(await screen.findByText('SupplyOne Co Ltd')).toBeInTheDocument();
    expect(screen.getByText('SUP01')).toBeInTheDocument();
  });

  it('shows an empty state when there are no suppliers', async () => {
    mockApi({ 'GET /suppliers': { items: [], total: 0, page: 1, pageSize: 20 } });

    renderSuppliers();

    expect(await screen.findByText('ยังไม่มีผู้ขาย')).toBeInTheDocument();
  });

  it('surfaces the Thai error envelope when a duplicate code is submitted', async () => {
    mockApi({
      'GET /suppliers': { items: [supplyOne], total: 1, page: 1, pageSize: 20 },
      'POST /suppliers': envelope('CONFLICT', 'รหัสผู้ขายนี้ถูกใช้แล้ว', ['code']),
    });

    renderSuppliers();

    fireEvent.change(await screen.findByLabelText('รหัสผู้ขาย'), { target: { value: 'SUP01' } });
    fireEvent.change(screen.getByLabelText('ชื่อผู้ขาย'), { target: { value: 'ผู้ขายใหม่' } });
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มผู้ขาย' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('รหัสผู้ขายนี้ถูกใช้แล้ว');
  });
});

describe('Suppliers navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets an Administrator reach the suppliers screen from the navigation', async () => {
    mockApi({
      'GET /auth/me': { user: admin },
      'GET /suppliers': { items: [supplyOne], total: 1, page: 1, pageSize: 20 },
    });

    renderApp('/');

    fireEvent.click(await screen.findByRole('link', { name: 'ผู้ขาย' }));

    expect(await screen.findByRole('heading', { name: 'ผู้ขาย' })).toBeInTheDocument();
    expect(await screen.findByText('SupplyOne Co Ltd')).toBeInTheDocument();
  });

  it('hides the suppliers link from a non-Administrator', async () => {
    mockApi({ 'GET /auth/me': { user: staff } });

    renderApp('/');

    expect(await screen.findByText('Welcome 👋')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ผู้ขาย' })).not.toBeInTheDocument();
  });
});
