import { redirect } from 'next/navigation';
import { getMyShop } from '@/lib/auth';
import { DashboardNav } from './DashboardNav';
import { CodeBadge } from '@/components/ui/CodeBadge';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const shop = await getMyShop();
  if (!shop) redirect('/login?as=printer&next=/dashboard');

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-52 shrink-0 md:block">
        <div className="mb-5">
          <p className="font-display text-lg font-extrabold leading-tight text-navy">{shop.businessName}</p>
          <div className="mt-1.5"><CodeBadge code={shop.code} /></div>
        </div>
        <DashboardNav variant="side" />
      </aside>
      <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>
      {/* Mobile: the dashboard gets its own bottom tab bar */}
      <DashboardNav variant="bottom" />
    </div>
  );
}
