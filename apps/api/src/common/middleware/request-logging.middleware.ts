import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

type RequestWithId = Request & {
    requestId?: string
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
    use(req: RequestWithId, res: Response, next: NextFunction) {
        const startedAt = Date.now();
        const request = req as RequestWithId;

        res.on('finish', () => {
            const logLine = {
                level: 'info',
                message: 'request_completed',
                requestId: request.requestId,
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Date.now() - startedAt,
            };
            console.log(JSON.stringify(logLine));
        });
        next();
    }
}
