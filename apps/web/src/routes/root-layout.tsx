import { Link, Outlet } from 'react-router';
import { UserMenu } from '@/components/user-menu';
import { useCurrentUser } from '@/lib/auth';

export function RootLayout() {
  const user = useCurrentUser();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6 font-semibold">
          <div className="flex items-center gap-6">
            <Link to="/">ERP Workshop</Link>
            {/* Administrator-only master data. The API still enforces @Roles('ADMINISTRATOR'). */}
            {user?.role === 'ADMINISTRATOR' && (
              <nav className="flex items-center gap-4 text-sm font-normal">
                <Link to="/stores" className="text-muted-foreground hover:text-foreground">
                  สาขา
                </Link>
                <Link to="/suppliers" className="text-muted-foreground hover:text-foreground">
                  ผู้ขาย
                </Link>
              </nav>
            )}
          </div>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
