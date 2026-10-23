export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface RegisterExternalUrlInput {
  url: string;
  mimeType?: string;
  byteSize?: number;
}

export interface StoredMedia {
  provider: string;
  storageKey: string | null;
  publicUrl: string;
  mimeType: string | null;
  byteSize: number | null;
}

/**
 * Swap implementations (S3, R2, local disk) without changing MediaAsset FKs.
 */
export interface MediaStorageProvider {
  readonly name: string;
  registerExternalUrl(input: RegisterExternalUrlInput): Promise<StoredMedia>;
}
