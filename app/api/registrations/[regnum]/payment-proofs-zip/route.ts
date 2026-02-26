import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const BUCKET_NAME = 'payment-proofs';

function resolveProofUrl(urlOrPath: string): string {
  const trimmed = urlOrPath.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(cleanPath);
  return data.publicUrl;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { regnum: string } }
) {
  try {
    await requireAuth(['admin', 'reviewer']);

    const decodedRegnum = decodeURIComponent(params.regnum);
    let regid: string | null = null;
    let confcode: string | null = null;
    let batchnum: number | null = null;

    // Resolve regnum to regid and get confcode, batchnum
    const { data: regById, error: errorById } = await supabase
      .from('regh')
      .select('regid, confcode, batchnum')
      .eq('regid', decodedRegnum)
      .maybeSingle();

    if (!errorById && regById) {
      regid = regById.regid;
      confcode = regById.confcode ?? null;
      batchnum = regById.batchnum ?? null;
    } else {
      const num = parseInt(params.regnum);
      if (!isNaN(num) && /^\d+$/.test(params.regnum)) {
        const { data: regByBatch, error: errorByBatch } = await supabase
          .from('regh')
          .select('regid, confcode, batchnum')
          .eq('batchnum', num)
          .maybeSingle();
        if (!errorByBatch && regByBatch) {
          regid = regByBatch.regid;
          confcode = regByBatch.confcode ?? null;
          batchnum = regByBatch.batchnum ?? null;
        }
      }
    }

    if (!regid) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const { data: paymentProofs, error } = await supabase
      .from('regdep')
      .select('payment_proof_url')
      .eq('regid', regid);

    if (error) {
      console.error('Database error fetching payment proofs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payment proofs' },
        { status: 500 }
      );
    }

    let urls = (paymentProofs || [])
      .map((p) => p.payment_proof_url)
      .filter((u): u is string => !!u && typeof u === 'string' && u.trim() !== '');

    // Fallback: list storage bucket files by regid pattern
    if (urls.length === 0) {
      try {
        const { data: bucketFiles, error: listError } = await supabase.storage
          .from(BUCKET_NAME)
          .list('', { limit: 500, sortBy: { column: 'name', order: 'asc' } });

        if (!listError && bucketFiles) {
          const matchingFiles = bucketFiles.filter(
            (f) =>
              f.name &&
              (f.name.toLowerCase().startsWith(`payment-proof-${regid.toLowerCase()}`) ||
                f.name.toLowerCase().startsWith(`payment-proof-${regid.toLowerCase()}-`))
          );
          urls = matchingFiles.map((f) => {
            const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(f.name!);
            return data.publicUrl;
          });
        }
      } catch (e) {
        console.warn('Bucket fallback list error:', e);
      }
    }

    if (urls.length === 0) {
      return NextResponse.json(
        { error: 'No payment proofs found for this registration' },
        { status: 404 }
      );
    }

    const folderName = batchnum != null
      ? `${confcode || 'unknown'}_BATCH-${batchnum}`
      : `${confcode || 'unknown'}_${regid}`;

    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
    });

    let appendedCount = 0;
    for (let i = 0; i < urls.length; i++) {
      try {
        const resolvedUrl = resolveProofUrl(urls[i]);
        const res = await fetch(resolvedUrl);
        if (!res.ok) continue;

        const blob = await res.blob();
        const buf = Buffer.from(await blob.arrayBuffer());
        const ext = urls[i].includes('.pdf')
          ? '.pdf'
          : urls[i].match(/\.(jpg|jpeg|png|gif|webp)$/i)
            ? (urls[i].match(/\.(jpg|jpeg|png|gif|webp)$/i)![0] as string)
            : '.bin';
        archive.append(buf, { name: `${folderName}/proof-${i + 1}${ext}` });
        appendedCount++;
      } catch (e) {
        console.warn('Failed to fetch proof', i + 1, e);
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
    const filename = `payment-proofs-${folderName}.zip`;

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
    console.error('Payment proofs ZIP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
