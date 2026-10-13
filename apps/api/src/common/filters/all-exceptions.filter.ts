import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";

type RequestWithId = Request & {
    requestId?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<RequestWithId>();
        const statusCode =
            exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const error = 
            exception instanceof HttpException
            ? exception.name.replace(/Exception$/, '') || 'Error'
            : 'Internal Server Error';

        let message: string | string[] = 'Internal Server Error';

        if (exception instanceof HttpException) {
            const body = exception.getResponse();
            if (typeof body === 'string') {
                message = body;
            } else if (typeof body === 'object' && body !== null && 'message' in body) {
                message = (body as { message: string | string[] }).message;
            }
        }

        response.status(statusCode).json({
            statusCode,
            error,
            message,
            requestId: request.requestId ?? response.getHeader('x-request-id'),
            path: request.url,
            timestamp: new Date().toISOString(),
        });
    }
}