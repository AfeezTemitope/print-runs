'use client';

import { useEffect, useState, useTransition } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { getBanks, lookupAccount, saveBankAccount } from './actions';

export function BankForm({
  current,
}: { current: { bankName: string; accountNumber: string; accountName: string } | null }) {
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [found, setFound] = useState<string | null>(null);
  const [editing, setEditing] = useState(!current);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getBanks().then(setBanks); }, []);

  if (current && !editing) {
    return (
      <div className="rounded-2xl border border-success/40 bg-success/5 p-5">
        <p className="flex items-center gap-2 font-display text-[15px] font-extrabold text-navy">
          <BadgeCheck className="size-4 text-success" /> {current.accountName}
        </p>
        <p className="mt-1 text-[14px] text-black/65">
          {current.bankName} · ••••{current.accountNumber.slice(-4)}
        </p>
        <Button size="sm" variant="tertiary" className="mt-3" onClick={() => setEditing(true)}>
          Change account
        </Button>
      </div>
    );
  }

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? '';

  return (
    <div className="space-y-4 rounded-2xl border border-black/12 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bank">
          <Select value={bankCode} onChange={(e) => { setBankCode(e.target.value); setFound(null); }}>
            <option value="">{banks.length ? 'Choose your bank…' : 'Loading banks…'}</option>
            {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Account number">
          <Input inputMode="numeric" maxLength={10} value={accountNumber}
            onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10)); setFound(null); }}
            placeholder="0123456789" />
        </Field>
      </div>

      {/*
        The name comes back from the bank, not from the printer. Showing it before saving is
        what catches a single wrong digit — the alternative is finding out when their money
        lands in a stranger's account.
      */}
      {found ? (
        <div className="rounded-xl border border-blue/30 bg-blue/5 px-4 py-3">
          <p className="text-[13px] text-black/60">This account belongs to</p>
          <p className="font-display text-[16px] font-extrabold text-navy">{found}</p>
          <p className="mt-1 text-xs text-black/55">Only save if that&apos;s you or your business.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={() => {
              setError(null);
              start(async () => {
                const res = await saveBankAccount(accountNumber, bankCode, bankName);
                if (res?.error) setError(res.error); else setEditing(false);
              });
            }}>
              Yes, save this account
            </Button>
            <Button size="sm" variant="tertiary" onClick={() => setFound(null)}>That&apos;s not right</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" disabled={pending || accountNumber.length !== 10 || !bankCode} onClick={() => {
          setError(null);
          start(async () => {
            const res = await lookupAccount(accountNumber, bankCode);
            if (res && 'error' in res && res.error) setError(res.error);
            else if (res && 'accountName' in res && res.accountName) setFound(res.accountName);
          });
        }}>
          {pending ? 'Checking…' : 'Check account'}
        </Button>
      )}

      {error && <p className="text-sm text-red">{error}</p>}
    </div>
  );
}
