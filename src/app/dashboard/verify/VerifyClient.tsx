'use client';

import { useState, useTransition } from 'react';
import { BadgeCheck, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import { submitVerification } from './actions';

const DOC_TYPES = ['CAC certificate', 'Work permit', 'National ID', 'Driver\u2019s licence', 'International passport'];

export function VerifyClient({
  tier, submission,
}: {
  tier: number;
  submission: { status: string; note: string | null; submittedAt: string } | null;
}) {
  const [documentUrl, setDocumentUrl] = useState<string | undefined>();
  const [documentType, setDocumentType] = useState(DOC_TYPES[0]);
  const [socialUrl, setSocialUrl] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (tier >= 2) {
    return (
      <div className="mt-6 rounded-2xl border border-success/40 bg-success/5 p-5">
        <p className="flex items-center gap-2 font-display text-[17px] font-extrabold text-navy">
          <BadgeCheck className="size-5 text-success" /> You&apos;re verified
        </p>
        <p className="mt-1 text-[14px] text-black/70">
          The badge now shows on your storefront, in search results and on every listing.
        </p>
      </div>
    );
  }

  const pendingReview = submission?.status === 'pending' && !sent;

  return (
    <div className="mt-6 space-y-5">
      {pendingReview && (
        <div className="rounded-2xl border border-blue/30 bg-blue/5 p-4">
          <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-navy">
            <Clock className="size-4 text-blue" /> Under review
          </p>
          <p className="mt-1 text-[13px] text-black/65">
            We&apos;re checking your documents. You&apos;ll keep receiving orders in the meantime.
          </p>
        </div>
      )}

      {submission?.status === 'rejected' && (
        <div className="rounded-2xl border border-red/30 bg-red/5 p-4">
          <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-navy">
            <XCircle className="size-4 text-red" /> Not approved
          </p>
          <p className="mt-1 text-[14px] text-black/70">{submission.note ?? 'Please submit a clearer document.'}</p>
          <p className="mt-1 text-[13px] text-black/55">Fix it and submit again below — there&apos;s no limit.</p>
        </div>
      )}

      {!pendingReview && (
        <div className="space-y-4 rounded-2xl border border-black/12 bg-white p-5">
          <Field label="Document type">
            <Select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Upload the document" hint="A clear photo or scan. PDF, PNG or JPG.">
            <PhotoUpload kind="permit" label="Document" aspect="aspect-[3/2]" url={documentUrl} onChange={setDocumentUrl} />
          </Field>
          <Field label="Instagram or Facebook page (optional)"
            hint="Real work posted publicly helps us confirm the business, and helps customers trust you.">
            <Input value={socialUrl} onChange={(e) => setSocialUrl(e.target.value)} placeholder="instagram.com/yourshop" />
          </Field>

          {error && <p className="text-sm text-red">{error}</p>}

          <Button size="sm" disabled={pending || !documentUrl} onClick={() => {
            setError(null);
            start(async () => {
              const res = await submitVerification(documentUrl ?? '', documentType, socialUrl);
              if (res?.error) setError(res.error); else setSent(true);
            });
          }}>
            {pending ? 'Sending…' : sent ? 'Submitted' : 'Submit for verification'}
          </Button>
        </div>
      )}
    </div>
  );
}
