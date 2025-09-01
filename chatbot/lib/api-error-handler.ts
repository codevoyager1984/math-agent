import { NextResponse } from 'next/server';

export interface ApiError {
  message: string;
  stack?: string;
  cause?: unknown;
  statusCode: number;
  endpoint: string;
  method: string;
  userId?: string;
  timestamp: string;
}

export function logError(error: unknown, context: {
  endpoint: string;
  method: string;
  userId?: string;
  requestBody?: unknown;
}): void {
  const timestamp = new Date().toISOString();
  const { endpoint, method, userId, requestBody } = context;

  let errorInfo: ApiError;

  if (error instanceof Error) {
    errorInfo = {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      statusCode: 500,
      endpoint,
      method,
      userId,
      timestamp,
    };
  } else {
    errorInfo = {
      message: 'Unknown error occurred',
      statusCode: 500,
      endpoint,
      method,
      userId,
      timestamp,
    };
  }

  // Log detailed error information
  console.error('=== API ERROR ===');
  console.error('Timestamp:', timestamp);
  console.error('Endpoint:', endpoint);
  console.error('Method:', method);
  console.error('User ID:', userId || 'N/A');
  console.error('Status Code:', errorInfo.statusCode);
  console.error('Error Message:', errorInfo.message);
  
  if (errorInfo.stack) {
    console.error('Stack Trace:', errorInfo.stack);
  }
  
  if (errorInfo.cause) {
    console.error('Cause:', errorInfo.cause);
  }

  if (requestBody) {
    console.error('Request Body:', JSON.stringify(requestBody, null, 2));
  }
  
  console.error('================');

  // In production, you might want to send this to a logging service
  // like Sentry, LogRocket, or custom logging endpoint
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to logging service
    // await sendToLoggingService(errorInfo);
  }
}

export function createErrorResponse(
  error: unknown,
  context: {
    endpoint: string;
    method: string;
    userId?: string;
    requestBody?: unknown;
  }
): NextResponse {
  logError(error, context);

  // Return generic error response to client
  return NextResponse.json(
    { 
      error: 'Internal server error occurred. Please try again later.',
      timestamp: new Date().toISOString()
    },
    { status: 500 }
  );
}

export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
  endpoint: string,
  method: string
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return createErrorResponse(error, {
        endpoint,
        method,
        // You can extract userId from request context if available
      });
    }
  };
}
