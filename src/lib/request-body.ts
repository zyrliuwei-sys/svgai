export class RequestBodyTooLargeError extends Error {}

/** Bound the actual streamed body, including chunked requests without Content-Length. */
export async function readRequestBytes(
  request: Request,
  limit: number
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get('content-length')) > limit)
    throw new RequestBodyTooLargeError();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
