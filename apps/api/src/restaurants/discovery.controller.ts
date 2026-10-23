import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DiscoveryService } from './discovery.service';
import { SearchService } from './search.service';
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

class SearchQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsUUID()
  operatingCityId?: string;
}

@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly searchService: SearchService,
  ) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search active restaurants by name, cuisine tags, or menu item names',
  })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'operatingCityId', required: false, type: String })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search({
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
      operatingCityId: query.operatingCityId,
    });
  }

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

  @Get('restaurants/:slug')
  @ApiOperation({
    summary: 'Public restaurant detail with active menu and ordering availability',
  })
  getRestaurantDetail(@Param('slug') slug: string) {
    return this.discoveryService.getRestaurantDetail(slug);
  }
}
