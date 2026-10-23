import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MEDIA_STORAGE } from './media-storage.provider';
import { ExternalUrlMediaStorageProvider } from './external-url-media-storage.provider';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [
    ExternalUrlMediaStorageProvider,
    {
      provide: MEDIA_STORAGE,
      useExisting: ExternalUrlMediaStorageProvider,
    },
    MediaService,
  ],
  exports: [MediaService, MEDIA_STORAGE],
})
export class MediaModule {}
