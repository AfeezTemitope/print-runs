'use client';

/**
 * Upload with a real progress percentage (brief item #8).
 *
 * fetch() cannot report upload progress — it only resolves once the whole request is done, so
 * a large design file looks like a frozen page. XMLHttpRequest still exposes upload.onprogress,
 * which is why it is used here rather than fetch.
 */
export type UploadResult = { url: string; name: string };

export function uploadWithProgress(
  file: File,
  endpoint: string,
  extra: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    for (const [k, v] of Object.entries(extra)) form.append(k, v);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      // Cap at 99 until the server actually answers: the bytes are sent, but the upload is
      // not finished until Cloudinary has stored it, and 100% followed by a wait feels broken.
      onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };

    xhr.onload = () => {
      let json: { url?: string; name?: string; error?: string } = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* fall through to the status check */ }
      if (xhr.status >= 200 && xhr.status < 300 && json.url) {
        onProgress(100);
        resolve({ url: json.url, name: json.name ?? file.name });
      } else {
        reject(new Error(json.error ?? 'Upload failed.'));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(form);
  });
}

/** The bar itself. Shown only while an upload is in flight. */
export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div className="mt-2" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/55">
          {label ?? 'Uploading'}
        </span>
        <span className="font-mono text-[11px] font-bold text-navy">{percent}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-black/10">
        <div
          className="h-full rounded-pill bg-blue transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
