import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getMyStudio, studioWorks, studioServices } from '@/lib/designers';
import { StudioClient, type StudioData } from './StudioClient';

export const metadata: Metadata = { title: 'My studio' };

export default async function StudioPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/studio');
  if (session.role !== 'designer' && session.role !== 'admin') redirect('/');

  const studio = await getMyStudio();
  const [works, services] = studio
    ? await Promise.all([studioWorks(studio.id), studioServices(studio.id, false)])
    : [[], []];

  const data: StudioData = studio
    ? {
        id: studio.id,
        code: studio.code,
        slug: studio.slug,
        displayName: studio.displayName,
        tagline: studio.tagline ?? '',
        bio: studio.bio ?? '',
        avatarUrl: studio.avatarUrl ?? '',
        bannerUrl: studio.bannerUrl ?? '',
        verification: studio.verification,
        verificationNote: studio.verificationNote,
        // reviewedAt is null until an admin has looked, so a null value with a pending
        // status is the difference between "not sent yet" and "waiting on us".
        submitted: studio.verification !== 'rejected' && studio.reviewedAt === null,
      }
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="mb-1 font-display text-3xl font-extrabold tracking-tight text-black">My studio</h1>
      <p className="mb-7 text-black/60">Your public profile, portfolio and prices.</p>
      <StudioClient
        studio={data}
        works={works.map((w) => ({ id: w.id, imageUrl: w.imageUrl, caption: w.caption }))}
        services={services}
      />
    </div>
  );
}
