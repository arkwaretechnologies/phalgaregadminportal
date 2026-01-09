'use client';

import { useState, useEffect } from 'react';

interface PaymentProofViewerProps {
  regnum: number;
  transid: string;
}

export default function PaymentProofViewer({ regnum, transid }: PaymentProofViewerProps) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchPaymentProof();
  }, [regnum]);

  const fetchPaymentProof = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/registrations/${regnum}/payment-proof`);
      const data = await response.json();

      if (response.ok && data.url) {
        setProofUrl(data.url);
      } else {
        setError(data.error || 'Payment proof not found');
      }
    } catch (err) {
      console.error('Error fetching payment proof:', err);
      setError('Failed to load payment proof');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <p className="text-sm font-medium text-blue-700">Loading payment proof...</p>
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

  if (!proofUrl) {
    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-1">Proof of Payment</p>
        <p className="text-sm text-gray-500">No payment proof uploaded</p>
      </div>
    );
  }

  const isImage = proofUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  const isPdf = proofUrl.toLowerCase().match(/\.pdf$/);

  return (
    <>
      <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Proof of Payment
        </p>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-green-700 font-medium">✓ Payment proof has been uploaded</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm hover:shadow"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Uploaded File
          </button>
          <button
            onClick={async () => {
              try {
                // Use our API endpoint to download the file to avoid CORS issues
                const response = await fetch(`/api/registrations/${regnum}/payment-proof?download=true`);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // Get filename from response headers or use default
                const contentDisposition = response.headers.get('content-disposition');
                let fileName = `payment-proof-${transid}.pdf`;
                if (contentDisposition) {
                  const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                  if (fileNameMatch) {
                    fileName = fileNameMatch[1].replace(/['"]/g, '');
                  }
                }
                link.download = fileName;
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Error downloading file:', error);
                // Fallback: open in new tab
                window.open(proofUrl, '_blank');
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>
      </div>

      {/* Payment Proof Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Payment Proof - Transaction ID: {transid}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)] flex items-center justify-center bg-gray-50">
              {isImage ? (
                <img
                  src={proofUrl}
                  alt="Payment Proof"
                  className="max-w-full max-h-[calc(90vh-150px)] object-contain rounded-lg shadow-lg"
                  onError={() => setError('Failed to load image')}
                />
              ) : isPdf ? (
                <iframe
                  src={proofUrl}
                  className="w-full h-[calc(90vh-150px)] rounded-lg shadow-lg border border-gray-300"
                  title="Payment Proof PDF"
                />
              ) : (
                <div className="text-center p-8">
                  <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(proofUrl, {
                          mode: 'cors',
                          credentials: 'omit',
                        });
                        
                        if (!response.ok) {
                          throw new Error('Failed to fetch file');
                        }
                        
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        
                        const urlParts = proofUrl.split('/');
                        const fileName = urlParts[urlParts.length - 1].split('?')[0];
                        const extension = fileName.match(/\.\w+$/)?.[0] || '.pdf';
                        link.download = `payment-proof-${transid}${extension}`;
                        
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error('Error downloading file:', error);
                        // Fallback: try using the download attribute
                        const link = document.createElement('a');
                        link.href = proofUrl;
                        const urlParts = proofUrl.split('/');
                        const fileName = urlParts[urlParts.length - 1].split('?')[0];
                        link.download = fileName || `payment-proof-${transid}.pdf`;
                        link.target = '_blank';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

