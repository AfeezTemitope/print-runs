import crypto from 'node:crypto';

export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

/**
 * Signed server-side upload via Cloudinary REST — no SDK needed.
 * `transform` is an eager transformation applied at upload time, so catalog photos are
 * resized once here rather than on every page view.
 */
async function upload(file: File, folder: string, transform?: string): Promise<{ url: string; name: string }> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signs the parameters in alphabetical order — eager before folder before timestamp.
  const parts = [
    transform ? `eager=${transform}` : '',
    `folder=${folder}`,
    `timestamp=${timestamp}`,
  ].filter(Boolean);
  const signature = crypto.createHash('sha1').update(parts.join('&') + apiSecret).digest('hex');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  if (transform) form.append('eager', transform);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? 'Upload failed');

  // Prefer the eagerly-transformed asset when one was requested.
  const eagerUrl = Array.isArray(json?.eager) ? json.eager[0]?.secure_url : undefined;
  return { url: (eagerUrl ?? json.secure_url) as string, name: file.name };
}

/** Customer artwork — kept at original resolution, since the printer prints from it. */
export function uploadDesignFile(file: File) {
  return upload(file, 'printruns/designs');
}

/**
 * Catalog and product photography. Capped at 1200px on the long edge and re-encoded, which
 * keeps a phone photo straight off a printer's camera from becoming a 6MB page weight.
 */
export function uploadPhoto(file: File, kind: 'catalog' | 'products') {
  return upload(file, `printruns/${kind}`, 'c_limit,w_1200,h_1200,q_auto,f_auto');
}

/**
 * Work permits for category verification. No transformation — a permit may be a PDF, and
 * resizing a document you are about to read for its small print is the wrong instinct.
 */
export function uploadPermit(file: File) {
  return upload(file, 'printruns/permits');
}
