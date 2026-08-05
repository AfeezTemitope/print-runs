import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cloudinaryConfigured, uploadPhoto, uploadPermit } from '@/lib/cloudinary';

// Photos are shown on pages, not printed from, so the ceiling is much lower than artwork's.
const MAX_BYTES = 8 * 1024 * 1024;
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
// A work permit is a document, so PDFs are accepted for that kind only.
const OK_PERMIT_TYPES = [...OK_TYPES, 'application/pdf'];

export async function POST(req: Request) {
  const session = await getSession();
  // Only printers (their own product shots) and admins (the catalog) can put images on pages.
  if (!session || (session.role !== 'printer' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 401 });
  }

  if (!cloudinaryConfigured()) {
    return NextResponse.json({ error: 'Image uploads are not configured yet.' }, { status: 501 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const raw = form.get('kind');
  const kind = raw === 'catalog' ? 'catalog' : raw === 'permit' ? 'permit' : 'products';

  if (kind === 'catalog' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can change catalog photos.' }, { status: 403 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: 'No image received.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image is over 8MB.' }, { status: 413 });
  const allowed = kind === 'permit' ? OK_PERMIT_TYPES : OK_TYPES;
  if (!allowed.includes(file.type)) {
    return NextResponse.json({
      error: kind === 'permit' ? 'Use a PDF, PNG or JPG.' : 'Use a PNG, JPG or WEBP image.',
    }, { status: 415 });
  }

  try {
    const { url } = kind === 'permit' ? await uploadPermit(file) : await uploadPhoto(file, kind);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed.' }, { status: 502 });
  }
}
