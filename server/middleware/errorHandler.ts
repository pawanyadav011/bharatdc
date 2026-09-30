import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
  code?: string;
}

/**
 * Strips any sensitive credentials, URLs, tokens, or connection strings from error messages
 */
const sanitizeErrorMessage = (message: string): string => {
  if (!message) return 'An internal server error occurred';
  return message
    .replace(/postgresql:\/\/[^@\s]+@[^\s/]+/gi, 'postgresql://[REDACTED]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/password=[^&\s]+/gi, 'password=[REDACTED]')
    .replace(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_TOKEN]')
    .replace(/sb_publishable_[A-Za-z0-9_-]+/gi, '[REDACTED_KEY]')
    .replace(/sb_secret_[A-Za-z0-9_-]+/gi, '[REDACTED_KEY]');
};

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  let statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  if (err.message && err.message.includes('CORS policy violation')) {
    statusCode = 403;
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const rawMessage = err.message || 'Internal Server Error';
  const cleanMessage = sanitizeErrorMessage(rawMessage);

  // In production, mask unhandled 500 errors to prevent leaking internal stack/query details
  const publicMessage =
    statusCode === 500 && isProduction
      ? 'An unexpected error occurred while processing your request.'
      : cleanMessage;

  console.error(`[API Error] [${req.method}] ${req.originalUrl} - ${statusCode}: ${cleanMessage}`);

  res.status(statusCode).json({
    success: false,
    error: publicMessage,
    code: err.code || undefined,
    details: !isProduction && err.details ? err.details : undefined,
  });
};
