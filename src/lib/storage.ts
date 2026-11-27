import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

/**
 * File storage for uploaded media. Files are always served through
 * /api/media/<key> (signed-in users only), so the blob container stays private.
 *
 *  - AZURE_STORAGE_ACCOUNT_URL set -> Azure Blob Storage via managed identity
 *    (DefaultAzureCredential; set AZURE_CLIENT_ID for a user-assigned identity)
 *  - otherwise -> local disk under UPLOAD_DIR (default ./.data/uploads)
 */

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function extForType(type: string) {
  return ALLOWED[type];
}

export function typeForKey(key: string) {
  const ext = key.split(".").pop()?.toLowerCase();
  return Object.entries(ALLOWED).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}

const KEY_RE = /^[a-z0-9-]+\/[a-f0-9-]{36}\.[a-z0-9]{2,5}$/;
export function isValidKey(key: string) {
  return KEY_RE.test(key);
}

const uploadDir = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./.data/uploads");

type BlobContainer = import("@azure/storage-blob").ContainerClient;
let containerPromise: Promise<BlobContainer> | null = null;

function azureContainer(): Promise<BlobContainer> | null {
  const account = process.env.AZURE_STORAGE_ACCOUNT_URL;
  if (!account) return null;
  containerPromise ??= (async () => {
    const { BlobServiceClient } = await import("@azure/storage-blob");
    const { DefaultAzureCredential } = await import("@azure/identity");
    const svc = new BlobServiceClient(
      account,
      new DefaultAzureCredential({ managedIdentityClientId: process.env.AZURE_CLIENT_ID }),
    );
    const container = svc.getContainerClient(process.env.AZURE_STORAGE_CONTAINER ?? "media");
    await container.createIfNotExists();
    return container;
  })();
  return containerPromise;
}

/** Stores a file and returns the URL path it is served from. */
export async function putFile(data: Buffer, contentType: string, folder = "media"): Promise<string> {
  const ext = extForType(contentType);
  if (!ext) throw new Error(`Unsupported file type: ${contentType}`);
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new Error("File is too large (max 50 MB)");
  const key = `${folder}/${randomUUID()}.${ext}`;

  const az = azureContainer();
  if (az) {
    const container = await az;
    await container.getBlockBlobClient(key).uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: "private, max-age=31536000, immutable" },
    });
  } else {
    const file = path.join(/*turbopackIgnore: true*/ uploadDir(), key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }
  return `/api/media/${key}`;
}

/** Reads a stored file, or null when missing. */
export async function getFile(key: string): Promise<{ body: ReadableStream | Buffer; size?: number } | null> {
  if (!isValidKey(key)) return null;
  const az = azureContainer();
  if (az) {
    const container = await az;
    try {
      const res = await container.getBlobClient(key).download();
      const node = res.readableStreamBody;
      if (!node) return null;
      const { Readable } = await import("node:stream");
      return { body: Readable.toWeb(node as import("node:stream").Readable) as ReadableStream, size: res.contentLength };
    } catch {
      return null;
    }
  }
  try {
    const buf = await fs.readFile(path.join(/*turbopackIgnore: true*/ uploadDir(), key));
    return { body: buf, size: buf.byteLength };
  } catch {
    return null;
  }
}
