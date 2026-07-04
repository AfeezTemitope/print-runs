'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { LAGOS } from '@/lib/geo';
import { Button } from '@/components/ui/Button';

/** Auto-detect the customer's location (spec §3 screen 4), with a graceful Lagos-wide fallback. */
export function LocateGate() {
  const router = useRouter();
  const params = useSearchParams();
  const [denied, setDenied] = useState(false);

  function go(lat: number, lng: number) {
    const p = new URLSearchParams(params.toString());
    p.set('lat', lat.toFixed(5));
    p.set('lng', lng.toFixed(5));
    router.replace(`/printers?${p.toString()}`);
  }

  useEffect(() => {
    if (!('geolocation' in navigator)) { go(LAGOS.lat, LAGOS.lng); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => go(pos.coords.latitude, pos.coords.longitude),
      () => setDenied(true),
      { timeout: 8000, maximumAge: 300000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-pale">
        <MapPin className="size-6 text-navy" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-extrabold text-navy">
        {denied ? 'Location not shared' : 'Finding printers near you…'}
      </h1>
      <p className="mt-2 text-sm text-black/55">
        {denied
          ? 'No wahala — we can show all Lagos printers instead, just without distance sorting from your exact spot.'
          : 'We use your location once, to sort printers by distance. Nothing is stored.'}
      </p>
      {denied && (
        <Button className="mt-6" onClick={() => go(LAGOS.lat, LAGOS.lng)}>
          Show Lagos printers <span aria-hidden>→</span>
        </Button>
      )}
    </div>
  );
}
