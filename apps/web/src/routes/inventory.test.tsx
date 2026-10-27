import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/components/require-auth';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { HomePage } from './home';
import { InventoryPage } from './inventory';
import { RootLayout } from './root-layout';

const level = {
  productId: 'p1',
  sku: 'SKU001',
  productName: 'น้ำดื่มแพ็ค 6',
  unit: 'แพ็ค',
  storeId: 's1',
  storeCode: 'B01',
  storeName: 'สาขาเซ็นทรัล',
  quantity: 10,
  reorderThreshold: 3,
  isLowStock: false,
};
const lowStock = {
  ...level,
  productId: 'p3',
  sku: 'SKU003',
  productName: 'น้ำยาซักผ้า',
  unit: 'ถุง',
  quantity: 0,
  isLowStock: true,
};
const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 20 });

const staff = {
  id: '2',
  email: 'staff_b01@erp.local',
  name: 'Staff B01',
  role: 'STORE_EMPLOYEE',
  storeId: 's1',
};

function renderInventory() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <InventoryPage />
    </QueryClientProvider>,
  );
}

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
              { path: 'inventory', element: <InventoryPage /> },
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

function row(name: RegExp) {
  return screen.getByRole('row', { name });
}

describe('InventoryPage (INV-01)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state while the stock list is pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    renderInventory();

    expect(screen.getByText('กำลังโหลด…')).toBeInTheDocument();
  });

  it('shows SKU, product, store, quantity, unit and threshold for each row', async () => {
    mockApi({ 'GET /inventory': page([level]) });

    renderInventory();

    const r = within(await screen.findByRole('row', { name: /SKU001/ }));
    expect(r.getByText('น้ำดื่มแพ็ค 6')).toBeInTheDocument();
    expect(r.getByText('B01 สาขาเซ็นทรัล')).toBeInTheDocument();
    expect(r.getByRole('cell', { name: '10' })).toBeInTheDocument();
    expect(r.getByRole('cell', { name: 'แพ็ค' })).toBeInTheDocument();
    expect(r.getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(r.getByText('ปกติ')).toBeInTheDocument();
  });

  it('flags a row at or under its threshold as low stock', async () => {
    mockApi({ 'GET /inventory': page([level, lowStock]) });

    renderInventory();

    // The same row-name pattern the browser test (apps/e2e) locates rows by.
    await screen.findByRole('row', { name: /^SKU003 .* B01 / });
    expect(within(row(/SKU003/)).getByText('สต็อกต่ำ')).toBeInTheDocument();
    expect(within(row(/SKU001/)).queryByText('สต็อกต่ำ')).not.toBeInTheDocument();
  });

  it('shows a dash when no threshold is configured', async () => {
    mockApi({ 'GET /inventory': page([{ ...level, reorderThreshold: null }]) });

    renderInventory();

    const r = within(await screen.findByRole('row', { name: /SKU001/ }));
    expect(r.getByRole('cell', { name: '-' })).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    mockApi({ 'GET /inventory': page([]) });

    renderInventory();

    expect(await screen.findByText('ไม่พบสินค้าในสต็อก')).toBeInTheDocument();
  });

  it('shows an error that tells the user to retry when the request fails', async () => {
    mockApi({
      'GET /inventory': Response.json(
        { defined: false, code: 'INTERNAL_SERVER_ERROR', status: 500, message: 'x' },
        { status: 500 },
      ),
    });

    renderInventory();

    // The query client retries a failed request once before giving up.
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'ลองใหม่อีกครั้ง',
    );
  });

  it('searches by SKU, product name or store through the typed route', async () => {
    const fetchMock = mockApi({ 'GET /inventory': page([level]) });

    renderInventory();

    await screen.findByRole('row', { name: /SKU001/ });
    fireEvent.change(screen.getByLabelText('ค้นหา SKU ชื่อสินค้า หรือสาขา'), {
      target: { value: 'B02' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ค้นหา' }));

    await vi.waitFor(() => {
      const urls = fetchMock.mock.calls.map(([req]: [Request]) => new URL(req.url));
      expect(
        urls.some((u) => u.pathname === '/api/inventory' && u.searchParams.get('search') === 'B02'),
      ).toBe(true);
    });
  });
});

describe('Inventory navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets a store employee reach the stock screen from the navigation', async () => {
    mockApi({ 'GET /auth/me': { user: staff }, 'GET /inventory': page([level]) });

    renderApp('/');

    fireEvent.click(await screen.findByRole('link', { name: 'สต็อก' }));

    expect(await screen.findByRole('heading', { name: 'สต็อกสินค้า' })).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /SKU001/ })).toBeInTheDocument();
  });
});
