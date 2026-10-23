import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { DiscoveryService } from './discovery.service';
import {
  OptionalSessionAuthGuard,
  type OptionallyAuthenticatedRequest,
} from '../auth/optional-session-auth.guard';

class DiscoverRestaurantsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsUUID()
  operatingCityId?: string;

  @IsOptional()
  @IsUUID()
  addressId?: string;
}

@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('restaurants')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({
    summary:
      'Discover orderable restaurants near a delivery pin (radius + platform city coverage)',
  })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({ name: 'operatingCityId', required: false, type: String })
  @ApiQuery({ name: 'addressId', required: false, type: String })
  discover(
    @Query() query: DiscoverRestaurantsQueryDto,
    @Req() req: OptionallyAuthenticatedRequest,
  ) {
    return this.discoveryService.discoverRestaurants({
      latitude: query.latitude,
      longitude: query.longitude,
      operatingCityId: query.operatingCityId,
      addressId: query.addressId,
      userId: req.user?.id,
    });
  }
}
