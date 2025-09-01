import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import { logError, createErrorResponse } from '@/lib/api-error-handler';
import { uploadFileToOSS } from '@/lib/oss-upload';

// Supported file types for upload
const SUPPORTED_FILE_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  // Office documents
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
];

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 10 * 1024 * 1024, {
      message: 'File size should be less than 10MB',
    })
    .refine((file) => SUPPORTED_FILE_TYPES.includes(file.type), {
      message: `File type not supported. Supported types: ${SUPPORTED_FILE_TYPES.join(', ')}`,
    }),
});

export async function POST(request: Request) {
  const endpoint = '/api/files/upload';
  const method = 'POST';
  
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user?.id;

    if (request.body === null) {
      return new Response('Request body is empty', { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = (formData.get('file') as File).name;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await uploadFileToOSS(
      fileBuffer,
      filename,
      file.type
    );

    return NextResponse.json({
      url: uploadResult.url,
      pathname: uploadResult.name,
      contentType: uploadResult.contentType,
      size: uploadResult.size
    });
  } catch (error) {
    // Get session for error logging if possible
    let userId: string | undefined;
    try {
      const session = await auth();
      userId = session?.user?.id;
    } catch {
      // Ignore auth errors in error handler
    }

    return createErrorResponse(error, {
      endpoint,
      method,
      userId,
      requestBody: 'FormData with file upload'
    });
  }
}
