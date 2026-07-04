'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { toggleProduct } from './actions';

export function ToggleActive({ productId, isActive }: { productId: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={isActive ? 'secondary' : 'tertiary'}
      size="sm"
      disabled={pending}
      onClick={() => start(async () => { await toggleProduct(productId); })}
    >
      {isActive ? 'Live' : 'Hidden'}
    </Button>
  );
}
