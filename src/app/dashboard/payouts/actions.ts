'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { listBanks, resolveAccount } from '@/lib/paystack';
import { requestAdvance } from '@/lib/payouts';

export async function getBanks() {
  const res = await listBanks();
  return res.ok ? res.data : [];
}

/**
 * Look the account up BEFORE saving, so the printer sees the name the bank holds and can
 * catch a wrong digit. Nothing is stored here — saving is a separate, deliberate step.
 */
export async function lookupAccount(accountNumber: string, bankCode: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (!/^\d{10}$/.test(accountNumber)) return { error: 'A Nigerian account number is 10 digits.' };
  if (!bankCode) return { error: 'Choose your bank.' };

  const res = await resolveAccount(accountNumber, bankCode);
  if (!res.ok) return { error: 'We could not find that account. Check the number and the bank.' };
  return { ok: true as const, accountName: res.data.account_name };
}

export async function saveBankAccount(accountNumber: string, bankCode: string, bankName: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (!/^\d{10}$/.test(accountNumber)) return { error: 'A Nigerian account number is 10 digits.' };

  // Re-resolved on save rather than trusting the name from the lookup step, which came from
  // the browser and could have been edited.
  const res = await resolveAccount(accountNumber, bankCode);
  if (!res.ok) return { error: 'We could not verify that account. Check the number and the bank.' };

  await db().update(tables.shops).set({
    bankCode,
    bankName,
    accountNumber,
    accountName: res.data.account_name,
    bankVerifiedAt: new Date(),
    // A changed account needs a fresh Paystack recipient — the old one points at the old account.
    paystackRecipientCode: null,
  }).where(eq(tables.shops.id, shop.id));

  revalidatePath('/dashboard/payouts');
  return { ok: true as const, accountName: res.data.account_name };
}

export async function askForAdvance(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  const res = await requestAdvance(orderId, shop.id);
  if (!res.ok) return { error: res.message };
  revalidatePath('/dashboard/payouts');
  revalidatePath('/dashboard/queue');
  revalidatePath('/admin/payouts');
  return { ok: true as const, amountKobo: res.amountKobo };
}
