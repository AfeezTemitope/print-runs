import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cloudinaryConfigured, uploadDesignFile } from '@/lib/cloudinary';

const MAX_BYTES = 20 * 1024 * 1024;
// CorelDraw files report inconsistent MIME types across browsers (and often none at all), so
// .cdr and .ai are accepted by extension rather than by type. QA 1.6 added CDR platform-wide;
// the file picker allowed it before this route did.
const OK_TYPES = [
  'application/pdf', 'image/png', 'image/jpeg',
  'application/postscript', 'application/illustrator',
  'application/x-coreldraw', 'application/cdr', 'image/x-coreldraw',
];
const OK_EXTENSIONS = ['.ai', '.cdr'];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in to upload a file.' }, { status: 401 });

  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      { error: 'File uploads are not configured yet. You can still place the order — send the file to the printer after.' },
      { status: 501 },
    );
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is over 20MB.' }, { status: 413 });
  const byExtension = OK_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  if (file.type && !OK_TYPES.includes(file.type) && !byExtension) {
    return NextResponse.json({ error: 'Use PDF, AI, CDR, PNG or JPG.' }, { status: 415 });
  }

  try {
    const { url, name } = await uploadDesignFile(file);
    return NextResponse.json({ ok: true, url, name });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed.' }, { status: 502 });
  }
}
