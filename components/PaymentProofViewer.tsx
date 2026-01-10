'use client';

import { useState, useEffect, useCallback } from 'react';
import PaymentProofImageViewer from './PaymentProofImageViewer';

interface PaymentProof {
  url: string;
  uploaded_at: string;
}

interface PaymentProofViewerProps {
  batchnum: number | null;
  regid: string;
}

export default function PaymentProofViewer({ batchnum, regid }: PaymentProofViewerProps) {
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const fetchPaymentProofs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const identifier = batchnum || regid;
      const url = batchnum 
        ? `/api/registrations/${batchnum}/payment-proofs`
        : `/api/registrations/${encodeURIComponent(regid)}/payment-proofs`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.paymentProofs) {
        const proofs = Array.isArray(data.paymentProofs) ? data.paymentProofs : [];
        console.log('[PaymentProofViewer] Loaded payment proofs:', proofs.length);
        setPaymentProofs(proofs);
      } else {
        const errorMsg = data.error || 'Failed to load payment proofs';
        console.error('[PaymentProofViewer] Error loading payment proofs:', errorMsg, data);
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Error fetching payment proofs:', err);
      setError('Failed to load payment proofs');
    } finally {
      setLoading(false);
    }
  }, [batchnum, regid]);

  useEffect(() => {
    fetchPaymentProofs();
  }, [fetchPaymentProofs]);

  const isImageFile = (url: string) => url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  const isPdfFile = (url: string) => url.toLowerCase().match(/\.pdf$/);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const handleImageClick = (index: number) => {
    setViewerIndex(index);
  };

  if (loading) {
    return (
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <p className="text-sm font-medium text-blue-700">Loading payment proofs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-1">Proof of Payment</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (!loading && !error && paymentProofs.length === 0) {
    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-1">Proof of Payment</p>
        <p className="text-sm text-gray-500">No payment proofs uploaded</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Proof of Payment
        </p>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-green-700 font-medium">
            ✓ {paymentProofs.length} payment proof{paymentProofs.length !== 1 ? 's' : ''} uploaded
          </span>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {paymentProofs.map((proof, index) => {
            const isImage = isImageFile(proof.url);
            const isPdf = isPdfFile(proof.url);
            const hasImageError = imageErrors.has(index);

            return (
              <div
                key={index}
                className="relative group cursor-pointer bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-400 transition-all duration-200 aspect-square"
                onClick={() => handleImageClick(index)}
              >
                {isImage ? (
                  <>
                    {!hasImageError ? (
                      <img
                        src={proof.url}
                        alt={`Payment proof ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={() => {
                          setImageErrors(prev => new Set(prev).add(index));
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </>
                ) : isPdf ? (
                  <div className="w-full h-full flex items-center justify-center bg-red-50">
                    <div className="text-center">
                      <svg className="w-10 h-10 text-red-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-medium text-red-700">PDF</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}

                {/* Upload Date Badge */}
                {proof.uploaded_at && (
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-medium px-2 py-1 rounded-md z-10 shadow-sm border border-white/10">
                    {formatDate(proof.uploaded_at)}
                  </div>
                )}

                {/* Image Number Badge (if multiple) */}
                {paymentProofs.length > 1 && (
                  <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center z-10 shadow-md ring-2 ring-white">
                    {index + 1}
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center z-0">
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 bg-white/20 p-3 rounded-full backdrop-blur-sm border border-white/30 shadow-xl">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewerIndex !== null && (
        <PaymentProofImageViewer
          proofs={paymentProofs}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          regid={regid}
        />
      )}
    </>
  );
}
