import type { ProtectorMediaType } from "./types";

const DATABASE_NAME = "pet-screen-protector";
const DATABASE_VERSION = 1;
const MEDIA_STORE = "media";
const ACTIVE_MEDIA_KEY = "active-media";

export interface StoredMedia {
  id: typeof ACTIVE_MEDIA_KEY;
  blob: Blob;
  mediaType: ProtectorMediaType;
  mediaName: string;
  durationSeconds: number | null;
  updatedAt: number;
}

export async function saveActiveMedia(
  blob: Blob,
  mediaType: ProtectorMediaType,
  mediaName: string,
  durationSeconds: number | null = null
): Promise<void> {
  const database = await openDatabase();
  await requestToPromise(
    database
      .transaction(MEDIA_STORE, "readwrite")
      .objectStore(MEDIA_STORE)
      .put({ id: ACTIVE_MEDIA_KEY, blob, mediaType, mediaName, durationSeconds, updatedAt: Date.now() } satisfies StoredMedia)
  );
  database.close();
}

export async function getActiveMedia(): Promise<StoredMedia | null> {
  const database = await openDatabase();
  const media = await requestToPromise<StoredMedia | undefined>(
    database.transaction(MEDIA_STORE, "readonly").objectStore(MEDIA_STORE).get(ACTIVE_MEDIA_KEY)
  );
  database.close();
  return media ?? null;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(MEDIA_STORE, { keyPath: "id" });
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("Could not open media storage.")));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed.")));
  });
}
