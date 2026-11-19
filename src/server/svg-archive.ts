// Use a dedicated private R2 binding. The public uploads bucket is separate.
interface ArchiveBucket {
  put(
    key: string,
    content: string | Uint8Array,
    options: {
      onlyIf: Headers;
      httpMetadata: { contentType: string; cacheControl: string };
    }
  ): Promise<unknown>;
}

type ArchiveEnv = {
  SVG_ARCHIVE?: ArchiveBucket;
  SVG_ARCHIVE_REQUIRED?: string;
};

function archiveBucket() {
  const runtime = globalThis as typeof globalThis & {
    __CF_ENV__?: ArchiveEnv;
    __env__?: ArchiveEnv;
  };
  const env = runtime.__CF_ENV__ ?? runtime.__env__;
  if (
    !env?.SVG_ARCHIVE &&
    (env?.SVG_ARCHIVE_REQUIRED ?? process.env.SVG_ARCHIVE_REQUIRED) === 'true'
  ) {
    console.error('[svg-archive] Missing private SVG_ARCHIVE binding');
    throw new Error('SVG storage is temporarily unavailable');
  }
  return env?.SVG_ARCHIVE;
}

async function storeArtifact(
  bucket: ArchiveBucket,
  key: string,
  content: string | Uint8Array,
  contentType: string
) {
  try {
    // A committed DB result is immutable. A concurrent save or retry can
    // find the same key already present and safely reuse it.
    await bucket.put(key, content, {
      onlyIf: new Headers({ 'If-None-Match': '*' }),
      httpMetadata: { contentType, cacheControl: 'private, no-store' },
    });
  } catch {
    console.error('[svg-archive] Could not save generated artifact');
    throw new Error('SVG storage is temporarily unavailable');
  }
}

/** Read the committed SVG and ensure its archive exists before delivery. */
export async function archivedTaskSvg(task: {
  id: string;
  taskResult: string | null;
}) {
  const svg: unknown = JSON.parse(task.taskResult || '{}').svg;
  if (typeof svg !== 'string' || !svg) throw new Error('Missing SVG result');
  const bucket = archiveBucket();
  if (bucket)
    await storeArtifact(
      bucket,
      `tasks/${encodeURIComponent(task.id)}.svg`,
      svg,
      'image/svg+xml'
    );
  return svg;
}

export async function archivePreviewFiles(row: {
  id: string;
  status: string;
  svg: string | null;
  previewPng: string | null;
}) {
  if (row.status !== 'succeeded' || !row.svg || !row.previewPng) return;
  const bucket = archiveBucket();
  if (!bucket) return;
  const path = `previews/${encodeURIComponent(row.id)}`;
  await Promise.all([
    storeArtifact(bucket, `${path}.svg`, row.svg, 'image/svg+xml'),
    storeArtifact(
      bucket,
      `${path}.png`,
      Buffer.from(row.previewPng, 'base64'),
      'image/png'
    ),
  ]);
}
