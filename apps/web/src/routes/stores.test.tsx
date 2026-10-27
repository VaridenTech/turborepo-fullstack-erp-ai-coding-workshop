import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from '@/components/require-auth';
import { createQueryClient } from '@/lib/query-client';
import { mockApi } from '@/test/mock-api';
import { HomePage } from './home';
import { RootLayout } from './root-layout';
import { StoresPage } from './stores';

const central = {
  id: 's1',
  code: 'B01',
  name: 'สาขาเซ็นทรัล',
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
              { path: 'stores', element: <StoresPage /> },
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

function renderStores() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <StoresPage />
    </QueryClientProvider>,
  );
}

/** oRPC JSON error body carrying the shared Thai error envelope in `data`. */
function envelope(code: string, message: string, fields: string[], status = 409) {
  return Response.json(
    { defined: false, code, status, message, data: { code: 'STORE_CODE_TAKEN', message, fields } },
    { status },
  );
}

describe('StoresPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state while the list is pending', () => {
    // A fetch that never resolves keeps the query pending.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    renderStores();

    expect(screen.getByText('กำลังโหลด…')).toBeInTheDocument();
  });

  it('renders stores from the API in Thai', async () => {
    mockApi({ 'GET /stores': { items: [central], total: 1, page: 1, pageSize: 20 } });

    renderStores();

    expect(await screen.findByText('สาขาเซ็นทรัล')).toBeInTheDocument();
    expect(screen.getByText('B01')).toBeInTheDocument();
  });

  it('shows an empty state when there are no stores', async () => {
    mockApi({ 'GET /stores': { items: [], total: 0, page: 1, pageSize: 20 } });

    renderStores();

    expect(await screen.findByText('ยังไม่มีสาขา')).toBeInTheDocument();
  });

  it('surfaces the Thai error envelope when a duplicate code is submitted', async () => {
    mockApi({
      'GET /stores': { items: [central], total: 1, page: 1, pageSize: 20 },
      'POST /stores': envelope('CONFLICT', 'รหัสสาขานี้ถูกใช้แล้ว', ['code']),
    });

    renderStores();

    fireEvent.change(await screen.findByLabelText('รหัสสาขา'), { target: { value: 'B01' } });
    fireEvent.change(screen.getByLabelText('ชื่อสาขา'), { target: { value: 'สาขาใหม่' } });
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสาขา' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('รหัสสาขานี้ถูกใช้แล้ว');
  });
});

describe('Stores navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets an Administrator reach the stores screen from the navigation', async () => {
    mockApi({
      'GET /auth/me': { user: admin },
      'GET /stores': { items: [central], total: 1, page: 1, pageSize: 20 },
    });

    renderApp('/');

    fireEvent.click(await screen.findByRole('link', { name: 'สาขา' }));

    expect(await screen.findByRole('heading', { name: 'สาขา' })).toBeInTheDocument();
    expect(await screen.findByText('สาขาเซ็นทรัล')).toBeInTheDocument();
  });

  it('hides the stores link from a non-Administrator', async () => {
    mockApi({ 'GET /auth/me': { user: staff } });

    renderApp('/');

    expect(await screen.findByText('Welcome 👋')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'สาขา' })).not.toBeInTheDocument();
  });
});
