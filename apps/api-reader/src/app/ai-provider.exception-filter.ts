import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { AiProviderError } from '@metrics-platform/marketing-application';
import type { Response } from 'express';

@Catch(AiProviderError)
export class AiProviderExceptionFilter implements ExceptionFilter {
  catch(error: AiProviderError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.resolveStatus(error);
    response.status(status).json({
      statusCode: status,
      error: error.code,
      message: error.message,
    });
  }

  private resolveStatus(error: AiProviderError): number {
    if (error.httpStatus === 429) return HttpStatus.TOO_MANY_REQUESTS;
    if (error.code === 'AI_PROVIDER_NOT_CONFIGURED') return HttpStatus.SERVICE_UNAVAILABLE;
    if (error.code === 'AI_CONTEXT_EMPTY') return HttpStatus.UNPROCESSABLE_ENTITY;
    if (error.code === 'AI_UNSUPPORTED_PROVIDER') return HttpStatus.BAD_REQUEST;
    if (error.httpStatus === 401 || error.httpStatus === 403) return HttpStatus.BAD_GATEWAY;
    return HttpStatus.BAD_GATEWAY;
  }
}
