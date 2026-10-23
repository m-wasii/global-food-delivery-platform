import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MediaStorageProvider,
  RegisterExternalUrlInput,
  StoredMedia,
} from './media-storage.provider';

/**
 * Baseline provider: persist a caller-supplied HTTPS URL.
 * No binary upload — object storage can replace this later.
 */
@Injectable()
export class ExternalUrlMediaStorageProvider implements MediaStorageProvider {
  readonly name = 'external_url';

  async registerExternalUrl(input: RegisterExternalUrlInput): Promise<StoredMedia> {
    let parsed: URL;
    try {
      parsed = new URL(input.url);
    } catch {
      throw new BadRequestException('Invalid media URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Media URL must use http or https');
    }

    return {
      provider: this.name,
      storageKey: null,
      publicUrl: parsed.toString(),
      mimeType: input.mimeType ?? null,
      byteSize: input.byteSize ?? null,
    };
  }
}
