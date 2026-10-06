import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log('➡️ REQUEST IN', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      body:
        req.body && Object.keys(req.body).length > 0
          ? this.sanitizeBody(req.body)
          : null,
    });
    next();
  }

  private sanitizeBody(body: Record<string, unknown>) {
    const sanitized = { ...body };
    for (const field of [
      'password',
      'hashPassword',
      'token',
      'secret',
      'signature',
      'clientSecret',
      'privateKey',
      'client_secret',
      'private_key',
    ]) {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '***HIDDEN***';
      }
    }
    return sanitized;
  }
}
