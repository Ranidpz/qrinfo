import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { hasValidServerApiKey } from '@/lib/server-api-key';
import { getFattalTargetConfig, resolveFattalOwnerId } from '@/lib/content-intake/fattal-server';
import { fetchPdfBuffer, replaceCodePdfWithBuffer, type PdfReplacementInput } from '@/lib/content-intake/pdf-replacement';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const { codeId } = await params;
  const db = getAdminDb();

  try {
    if (!codeId) {
      return NextResponse.json({ error: 'codeId is required' }, { status: 400 });
    }

    const integrationAuth = hasValidServerApiKey(request, 'CONTENT_INTAKE_API_KEY', [
      'x-content-intake-key',
      'x-integration-key',
    ]);

    if (!integrationAuth) {
      const auth = await requireCodeOwner(request, codeId);
      if (isAuthError(auth)) return auth.response;
    }

    const codeRef = db.collection('codes').doc(codeId);
    const codeDoc = await codeRef.get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    const codeData = codeDoc.data() || {};
    const ownerId = String(codeData.ownerId || '');
    if (!ownerId) {
      return NextResponse.json({ error: 'Code owner is missing' }, { status: 400 });
    }

    if (integrationAuth) {
      const allowed = await resolveFattalOwnerId({ ownerId, integrationAuth: true });
      if (!allowed || !getFattalTargetConfig(String(codeData.shortId || '')) || codeData.parentCodeShortId) {
        return NextResponse.json(
          { error: 'Integration key is not allowed to update this QR target' },
          { status: 403 }
        );
      }
    }

    let input: PdfReplacementInput;
    try {
      input = await readPdfReplacementInput(request);
    } catch (error) {
      console.error('[PDF R2] Invalid input:', error);
      return NextResponse.json({ error: 'Invalid PDF replacement request' }, { status: 400 });
    }
    // Both entry points share ownership revalidation, storage accounting and rollback.
    const result = await replaceCodePdfWithBuffer(codeId, input, { expectedOwnerId: ownerId });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[PDF R2] Replacement error:', error);
    const message = error instanceof Error ? error.message : '';
    const inputErrors = ['Only PDF files are supported', 'PDF exceeds 25MB limit', 'Target media not found', 'Target media is not a PDF'];
    return NextResponse.json(
      { error: inputErrors.includes(message) || message === 'Storage quota exceeded' ? message : 'Failed to replace PDF' },
      { status: message === 'Storage quota exceeded' ? 409 : inputErrors.includes(message) ? 400 : 500 }
    );
  }
}

async function readPdfReplacementInput(request: NextRequest): Promise<PdfReplacementInput> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) throw new Error('file is required');

    return {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: stringValue(formData.get('filename')) || file.name || 'booklet.pdf',
      contentType: file.type || 'application/pdf',
      mediaId: stringValue(formData.get('mediaId')),
      title: stringValue(formData.get('title')),
      source: stringValue(formData.get('source')),
      sourceFileId: stringValue(formData.get('sourceFileId')),
      sourceMessageId: stringValue(formData.get('sourceMessageId')),
      detectedDate: stringValue(formData.get('detectedDate')),
      replaceNonPdf: booleanValue(formData.get('replaceNonPdf')),
      deleteOld: formData.has('deleteOld') ? booleanValue(formData.get('deleteOld')) : true,
    };
  }

  const body = await request.json() as Record<string, unknown>;
  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined;
  if (!sourceUrl) throw new Error('sourceUrl is required for JSON requests');

  const fetched = await fetchPdfBuffer(sourceUrl, typeof body.filename === 'string' ? body.filename : undefined);
  return {
    ...fetched,
    mediaId: typeof body.mediaId === 'string' ? body.mediaId : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    source: typeof body.source === 'string' ? body.source : 'api',
    sourceFileId: typeof body.sourceFileId === 'string' ? body.sourceFileId : undefined,
    sourceMessageId: typeof body.sourceMessageId === 'string' ? body.sourceMessageId : undefined,
    detectedDate: typeof body.detectedDate === 'string' ? body.detectedDate : undefined,
    replaceNonPdf: body.replaceNonPdf === true,
    deleteOld: body.deleteOld !== false,
  };
}

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: FormDataEntryValue | null): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}
