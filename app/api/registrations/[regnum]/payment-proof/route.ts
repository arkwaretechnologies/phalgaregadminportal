import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { regnum: string } }
) {
  const searchParams = request.nextUrl.searchParams;
  const isDownload = searchParams.get('download') === 'true';
  try {
    // Check authentication and role
    await requireAuth(['admin', 'reviewer']);

    const regnum = parseInt(params.regnum);

    if (isNaN(regnum)) {
      return NextResponse.json(
        { error: 'Invalid registration number' },
        { status: 400 }
      );
    }

    // Fetch registration to get transaction ID and payment proof URL
    const { data: registration, error: regError } = await supabase
      .from('regh')
      .select('transid, payment_proof_url')
      .eq('regnum', regnum)
      .single();

    if (regError || !registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    const bucketName = 'payment-proofs';
    const transid = registration.transid;
    let publicUrl: string | null = null;
    let fileName: string | null = null;

    // If payment_proof_url column has a value, check if it's a full URL or just a path
    if (registration.payment_proof_url) {
      const urlOrPath = registration.payment_proof_url.trim();
      
      // Check if it's already a full URL
      if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        // If it's a full URL, verify it's accessible
        try {
          const response = await fetch(urlOrPath, { method: 'HEAD' });
          if (response.ok) {
            publicUrl = urlOrPath;
            fileName = urlOrPath.split('/').pop() || 'payment-proof';
            // Don't return here - continue to check if download is requested
          }
        } catch {
          // URL might be incomplete or invalid, continue to search bucket
        }
      } else {
        // It's a file path, not a full URL
        const cleanPath = urlOrPath.startsWith('/') ? urlOrPath.slice(1) : urlOrPath;
        const { data: { publicUrl: url } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(cleanPath);
        
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            publicUrl = url;
            fileName = cleanPath;
            // Don't return here - continue to check if download is requested
          }
        } catch {
          // File not found at that path, continue to search
        }
      }
    }

    // If payment_proof_url is NULL or file not found, search bucket using naming pattern
    // Pattern: payment-proof-{TRANSID}-{timestamp}.{ext}
    // List files in bucket that start with payment-proof-{TRANSID}
    try {
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'desc' }
        });

      if (!listError && files) {
        // Find files that match the pattern: payment-proof-{TRANSID}
        const matchingFiles = files.filter(file => 
          file.name.toLowerCase().startsWith(`payment-proof-${transid.toLowerCase()}`) ||
          file.name.toLowerCase().startsWith(`payment-proof-${transid.toLowerCase()}-`)
        );

        if (matchingFiles.length > 0) {
          // Use the most recent file (first in descending order)
          const file = matchingFiles[0];
          fileName = file.name;
          const { data: { publicUrl: url } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(file.name);
          
          // Verify the file exists and is accessible
          try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
              publicUrl = url;
              // Don't return here - continue to check if download is requested
            }
          } catch {
            // File might not be accessible
          }
        }
      }
    } catch (error) {
      console.error('Error listing files from storage:', error);
    }

    if (!publicUrl) {
      return NextResponse.json(
        { error: 'Payment proof not found', transid: registration.transid },
        { status: 404 }
      );
    }

    // If download is requested, fetch and return the file with proper headers
    if (isDownload) {
      try {
        const fileResponse = await fetch(publicUrl);
        if (!fileResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to fetch payment proof file' },
            { status: 500 }
          );
        }
        
        const blob = await fileResponse.blob();
        const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
        
        // Extract filename from URL
        const urlParts = publicUrl.split('/');
        const urlFileName = urlParts[urlParts.length - 1].split('?')[0];
        const downloadFileName = fileName || urlFileName || `payment-proof-${registration.transid}.pdf`;
        
        return new NextResponse(blob, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${downloadFileName}"`,
            'Content-Length': blob.size.toString(),
          },
        });
      } catch (error) {
        console.error('Error fetching file for download:', error);
        return NextResponse.json(
          { error: 'Failed to download file' },
          { status: 500 }
        );
      }
    }

    // Return JSON with URL for viewing
    return NextResponse.json({ 
      url: publicUrl,
      fileName: fileName || 'payment-proof',
      transid: registration.transid 
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Payment proof fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

