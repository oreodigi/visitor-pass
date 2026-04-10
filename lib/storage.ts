import { createServerClient } from '@/lib/supabase/server';

type DbClient = ReturnType<typeof createServerClient>;

interface UploadPublicFileOptions {
  bucket: string;
  path: string;
  file: File;
}

function normalizeContentType(file: File): string {
  const rawExt = (file.name.split('.').pop() || '').toLowerCase();
  const extMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };

  return extMap[rawExt] || file.type || 'application/octet-stream';
}

export async function ensurePublicBucket(
  db: DbClient,
  bucket: string
): Promise<{ error?: string }> {
  const { data: buckets, error: listError } = await db.storage.listBuckets();
  if (listError) {
    console.error('Storage bucket list error:', listError);
    return { error: 'Failed to inspect storage buckets' };
  }

  if ((buckets || []).some((item) => item.id === bucket)) {
    return {};
  }

  const { error: createError } = await db.storage.createBucket(bucket, {
    public: true,
  });

  if (createError && !/already exists/i.test(createError.message || '')) {
    console.error('Storage bucket create error:', createError);
    return { error: `Failed to create storage bucket "${bucket}"` };
  }

  return {};
}

export async function uploadPublicFile(
  db: DbClient,
  { bucket, path, file }: UploadPublicFileOptions
): Promise<{ url?: string; error?: string }> {
  const bucketReady = await ensurePublicBucket(db, bucket);
  if (bucketReady.error) return bucketReady;

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = normalizeContentType(file);

  let upload = await db.storage
    .from(bucket)
    .upload(path, buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType,
    });

  if (upload.error && /bucket not found/i.test(upload.error.message || '')) {
    const retryReady = await ensurePublicBucket(db, bucket);
    if (retryReady.error) return retryReady;

    upload = await db.storage
      .from(bucket)
      .upload(path, buffer, {
        cacheControl: '3600',
        upsert: true,
        contentType,
      });
  }

  if (upload.error) {
    console.error('Storage upload error:', upload.error);
    return { error: upload.error.message || 'Failed to upload file' };
  }

  const {
    data: { publicUrl },
  } = db.storage.from(bucket).getPublicUrl(path);

  return { url: publicUrl };
}
