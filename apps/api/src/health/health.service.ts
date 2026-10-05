import { Injectable } from '@nestjs/common';
import { prisma } from '@food-delivery/database';
import { createClient } from 'redis';

@Injectable()
export class HealthService {
    async check() {
        const [database, redis] = await Promise.all([
            this.checkDatabase(),
            this.checkRedis(),
        ]);
        
        const status =
            database.status === 'up' && redis.status === 'up' ? 'ok' : 'error';

        return {
            status,
            service: 'api',
            timestamp: new Date().toISOString(),
            checks: {
                database,
                redis,
            },
        };
    }
    
    private async checkDatabase() {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return { status: 'up' as const };
        } catch {
            return { status: 'down' as const };
        }
    }

    private async checkRedis() {
        const url = process.env.REDIS_URL;
        if (!url) {
            return { status: 'down' as const };
        }

        const client = createClient({
            url,
            socket: {  connectTimeout: 2000, reconnectStrategy: false },
        });

        try {
            await client.connect();
            await client.ping();
            return { status: 'up' as const };
        } catch {
            return { status: 'down' as const };
        } finally {
            try {
                client.destroy();
            } catch {
                //ignore
            }
        }
    }
}