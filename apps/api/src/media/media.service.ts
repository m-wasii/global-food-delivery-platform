import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import {
  MEDIA_STORAGE,
  type MediaStorageProvider,
} from './media-storage.provider';
import { RegisterMediaDto } from './dto/register-media.dto';

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorageProvider,
  ) {}

  async registerExternalUrl(userId: string, dto: RegisterMediaDto) {
    const stored = await this.storage.registerExternalUrl({
      url: dto.url,
      mimeType: dto.mimeType,
      byteSize: dto.byteSize,
    });

    return prisma.mediaAsset.create({
      data: {
        provider: stored.provider,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        uploadedByUserId: userId,
      },
    });
  }

  async getById(id: string) {
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }
    return asset;
  }

  async requireExisting(id: string) {
    return this.getById(id);
  }
}
