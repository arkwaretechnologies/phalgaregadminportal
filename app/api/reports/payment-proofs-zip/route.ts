import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { APPROVED_STATUS_VALUES } from '@/lib/registration-status';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'payment-proofs';
const PARALLEL_FETCHES = 3;

function resolveProofUrl(urlOrPath: string): string {
  const trimmed = urlOrPath.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(cleanPath);
  return data.publicUrl;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const confcode = request.nextUrl.searchParams.get('confcode');
    if (!confcode || confcode.trim() === '') {
      return NextResponse.json(
        { error: 'confcode query parameter is required' },
        { status: 400 }
      );
    }

    const { data: registrations, error: regError } = await supabase
      .from('regh')
      .select('regid, confcode, batchnum')
      .in('status', [...APPROVED_STATUS_VALUES])
      .eq('confcode', confcode)
      .not('batchnum', 'is', null)
      .order('batchnum', { ascending: true });

    if (regError) {
      console.error('Error fetching registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch registrations' },
        { status: 500 }
      );
    }

    const regs = (registrations || []) as { regid: string; confcode: string | null; batchnum: number }[];
    if (regs.length === 0) {
      return NextResponse.json(
        { error: 'No approved registrations found for this conference' },
        { status: 404 }
      );
    }

    const regids = regs.map((r) => r.regid);

    const { data: regdepRows, error: depError } = await supabase
      .from('regdep')
      .select('regid, payment_proof_url')
      .in('regid', regids);

    if (depError) {
      console.error('Error fetching payment proofs:', depError);
      return NextResponse.json(
        { error: 'Failed to fetch payment proofs' },
        { status: 500 }
      );
    }

    const proofsByRegid = new Map<string, string[]>();
    for (const row of regdepRows || []) {
      const url = row.payment_proof_url;
      if (url && typeof url === 'string' && url.trim() !== '') {
        const list = proofsByRegid.get(row.regid) || [];
        list.push(url);
        proofsByRegid.set(row.regid, list);
      }
    }

    // Fallback: for regs with no proofs from regdep, list storage bucket files by regid pattern
    try {
      const { data: bucketFiles, error: listError } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

      if (!listError && bucketFiles) {
        for (const reg of regs) {
          const existing = proofsByRegid.get(reg.regid) || [];
          if (existing.length > 0) continue;

          const matchingFiles = bucketFiles.filter(
            (f) =>
              f.name &&
              (f.name.toLowerCase().startsWith(`payment-proof-${reg.regid.toLowerCase()}`) ||
                f.name.toLowerCase().startsWith(`payment-proof-${reg.regid.toLowerCase()}-`))
          );
          if (matchingFiles.length > 0) {
            const urls = matchingFiles.map((f) => {
              const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name);
              return data.publicUrl;
            });
            proofsByRegid.set(reg.regid, urls);
          }
        }
      }
    } catch (e) {
      console.warn('Bucket fallback list error:', e);
    }

    const totalProofs = Array.from(proofsByRegid.values()).reduce((sum, arr) => sum + arr.length, 0);
    if (totalProofs === 0) {
      return NextResponse.json(
        {
          error:
            'No payment proofs found for approved registrations. Proofs may be in regdep or in storage (payment-proof-{regid}*).',
        },
        { status: 404 }
      );
    }

    type QueuedItem = {
      url: string;
      folderName: string;
      index: number;
    };
    const queue: QueuedItem[] = [];
    for (const reg of regs) {
      const urls = proofsByRegid.get(reg.regid) || [];
      const folderName = `${reg.confcode || confcode}_BATCH-${reg.batchnum}`;
      for (let i = 0; i < urls.length; i++) {
        queue.push({ url: urls[i], folderName, index: i + 1 });
      }
    }

    const fetchOne = async (item: QueuedItem): Promise<{ buf: Buffer; ext: string; name: string } | null> => {
      try {
        const resolvedUrl = resolveProofUrl(item.url);
        const res = await fetch(resolvedUrl);
        if (!res.ok) return null;
        const blob = await res.blob();
        const buf = Buffer.from(await blob.arrayBuffer());
        const ext = item.url.includes('.pdf')
          ? '.pdf'
          : item.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
            ? (item.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)![0] as string)
            : '.bin';
        return { buf, ext, name: `${item.folderName}/proof-${item.index}${ext}` };
      } catch {
        return null;
      }
    };

    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
    });

    let appendedCount = 0;
    for (let i = 0; i < queue.length; i += PARALLEL_FETCHES) {
      const batch = queue.slice(i, i + PARALLEL_FETCHES);
      const results = await Promise.all(batch.map(fetchOne));
      for (const r of results) {
        if (r) {
          archive.append(r.buf, { name: r.name });
          appendedCount++;
        }
      }
    }

    if (appendedCount === 0) {
      return NextResponse.json(
        { error: 'Payment proof files could not be fetched from storage' },
        { status: 404 }
      );
    }

    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
      archive.finalize();
    });

    const zipBuffer = Buffer.concat(chunks);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `payment-proofs-${confcode}-${dateStr}.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Payment proofs bulk ZIP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
