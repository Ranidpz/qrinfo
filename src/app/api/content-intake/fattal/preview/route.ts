import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { hasValidServerApiKey } from '@/lib/server-api-key';
import { buildFattalPreview } from '@/lib/content-intake/fattal';
import { loadMappedFattalTargets, resolveFattalOwnerId } from '@/lib/content-intake/fattal-server';
import { createContentIntakeRun } from '@/lib/content-intake/runs';
import type { IntakeFileCandidate } from '@/lib/content-intake/types';

interface PreviewRequestBody {
  files?: unknown;
  receivedAt?: unknown;
  ownerId?: unknown;
  ownerEmail?: unknown;
  saveRun?: unknown;
  source?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const isIntegrationAuth = hasValidServerApiKey(request, 'CONTENT_INTAKE_API_KEY', [
      'x-content-intake-key',
      'x-integration-key',
    ]);

    let createdBy: string | undefined;
    if (!isIntegrationAuth) {
      const auth = await requireSuperAdmin(request);
      if (isAuthError(auth)) return auth.response;
      createdBy = auth.uid;
    }

    const body = await request.json() as PreviewRequestBody;
    const files = parseFiles(body.files);
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'At least one file is required' },
        { status: 400 }
      );
    }

    const ownerId = await resolveFattalOwnerId({
      ownerId: body.ownerId,
      ownerEmail: body.ownerEmail,
      integrationAuth: isIntegrationAuth,
    });
    if (!ownerId) {
      return NextResponse.json(
        { error: 'ownerId or ownerEmail is required for Fattal preview' },
        { status: 400 }
      );
    }

    const targets = await loadMappedFattalTargets(ownerId);
    if (targets.length === 0) {
      return NextResponse.json(
        { error: 'No mapped Fattal booklet QR targets found for the selected owner' },
        { status: 404 }
      );
    }

    const preview = buildFattalPreview({
      files,
      targets,
      receivedAt: typeof body.receivedAt === 'string' ? body.receivedAt : undefined,
    });

    if (body.saveRun !== false) {
      preview.runId = await createContentIntakeRun({
        ownerId,
        ownerEmail: typeof body.ownerEmail === 'string' ? body.ownerEmail : undefined,
        source: typeof body.source === 'string' ? body.source : 'manual',
        receivedAt: typeof body.receivedAt === 'string' ? body.receivedAt : undefined,
        createdBy,
        status: 'previewed',
        preview,
      });
    }

    return NextResponse.json(preview);
  } catch (error) {
    console.error('[Content Intake Fattal Preview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to build Fattal intake preview' },
      { status: 500 }
    );
  }
}

function parseFiles(value: unknown): IntakeFileCandidate[] {
  if (!Array.isArray(value)) return [];

  const files: IntakeFileCandidate[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== 'string' || raw.name.trim().length === 0) continue;

    files.push({
      id: typeof raw.id === 'string' ? raw.id : undefined,
      name: raw.name.trim(),
      size: typeof raw.size === 'number' ? raw.size : undefined,
      contentType: typeof raw.contentType === 'string' ? raw.contentType : undefined,
      receivedAt: typeof raw.receivedAt === 'string' ? raw.receivedAt : undefined,
      source: raw.source === 'whatsapp' || raw.source === 'email' || raw.source === 'drive' || raw.source === 'manual' || raw.source === 'api'
        ? raw.source
        : undefined,
      sourceMessageId: typeof raw.sourceMessageId === 'string' ? raw.sourceMessageId : undefined,
      senderName: typeof raw.senderName === 'string' ? raw.senderName : undefined,
    });
  }

  return files;
}
