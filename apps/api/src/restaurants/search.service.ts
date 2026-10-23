import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@food-delivery/database';

export interface SearchQuery {
  q: string;
  page?: number;
  pageSize?: number;
  operatingCityId?: string;
}

@Injectable()
export class SearchService {
  async search(query: SearchQuery) {
    const q = query.q.trim();
    if (q.length < 1) {
      throw new BadRequestException('Query q is required');
    }
    if (q.length > 100) {
      throw new BadRequestException('Query q is too long');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const pattern = q;

    const cityFilter = query.operatingCityId
      ? {
          branches: {
            some: {
              status: 'ACTIVE' as const,
              operatingCityId: query.operatingCityId,
              operatingCity: { isActive: true },
            },
          },
        }
      : {};

    const where = {
      status: 'ACTIVE' as const,
      ...cityFilter,
      OR: [
        { name: { contains: pattern, mode: 'insensitive' as const } },
        ...(await this.cuisineTagWhere(pattern)),
        {
          menus: {
            some: {
              isActive: true,
              categories: {
                some: {
                  items: {
                    some: {
                      isAvailable: true,
                      name: { contains: pattern, mode: 'insensitive' as const },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    };

    const [total, restaurants] = await Promise.all([
      prisma.restaurant.count({ where }),
      prisma.restaurant.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          cuisineTags: true,
          menus: {
            where: { isActive: true },
            select: {
              categories: {
                select: {
                  items: {
                    where: {
                      isAvailable: true,
                      name: { contains: pattern, mode: 'insensitive' },
                    },
                    select: {
                      id: true,
                      name: true,
                      priceCents: true,
                      currency: true,
                    },
                    take: 5,
                    orderBy: { name: 'asc' },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const results = restaurants.map((restaurant) => {
      const matchedItems = restaurant.menus.flatMap((menu) =>
        menu.categories.flatMap((category) => category.items),
      );
      const nameMatch = restaurant.name.toLowerCase().includes(pattern.toLowerCase());
      const cuisineMatch = restaurant.cuisineTags.some((tag) =>
        tag.toLowerCase().includes(pattern.toLowerCase()),
      );
      const matchReasons: Array<'name' | 'cuisine' | 'menu_item'> = [];
      if (nameMatch) matchReasons.push('name');
      if (cuisineMatch) matchReasons.push('cuisine');
      if (matchedItems.length > 0) matchReasons.push('menu_item');

      return {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          cuisineTags: restaurant.cuisineTags,
        },
        matchReasons,
        matchedItems,
      };
    });

    return {
      query: q,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 0,
      results,
    };
  }

  /** Case-insensitive cuisine tag match (baseline; loads active tags into memory). */
  private async cuisineTagWhere(
    pattern: string,
  ): Promise<Array<{ cuisineTags: { hasSome: string[] } }>> {
    const rows = await prisma.restaurant.findMany({
      where: { status: 'ACTIVE' },
      select: { cuisineTags: true },
    });
    const lower = pattern.toLowerCase();
    const matches = new Set<string>();
    for (const row of rows) {
      for (const tag of row.cuisineTags) {
        if (tag.toLowerCase().includes(lower)) matches.add(tag);
      }
    }
    if (matches.size === 0) return [];
    return [{ cuisineTags: { hasSome: [...matches] } }];
  }
}
