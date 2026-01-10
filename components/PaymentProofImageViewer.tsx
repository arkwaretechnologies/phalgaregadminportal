'use client';

import { useState, useEffect, useCallback } from 'react';

interface PaymentProof {
  url: string;
  uploaded_at: string;
}

interface PaymentProofImageViewerProps {
  proofs: PaymentProof[];
  initialIndex: number;
  onClose: () => void;
  regid: string;
}

const isImageFile = (url: string) => url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
const isPdfFile = (url: string) => url.toLowerCase().match(/\.pdf$/);

export default function PaymentProofImageViewer({
  proofs,
  initialIndex,
  onClose,
  regid,
}: PaymentProofImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentProof = proofs[currentIndex];

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % proofs.length);
  }, [proofs.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + proofs.length) % proofs.length);
  }, [proofs.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [goToNext, goToPrevious, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleDownload = async () => {
    if (!currentProof?.url) return;

    try {
      const response = await fetch(currentProof.url, {
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

      const urlParts = currentProof.url.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      const extension = fileName.match(/\.\w+$/)?.[0] || '.pdf';
      link.download = `payment-proof-${regid}-${currentIndex + 1}${extension}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      window.open(currentProof.url, '_blank');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (!currentProof) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
      onClick={onClose}
      style={{ colorScheme: 'light' }}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 z-20">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            Payment Proof {currentIndex + 1} of {proofs.length}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-full hover:bg-gray-100 flex-shrink-0 ml-2"
            aria-label="Close viewer"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-gray-100 relative overflow-hidden min-h-0 max-h-[calc(95vh-180px)]">
          {isImageFile(currentProof.url) ? (
            <div className="relative w-full h-full flex items-center justify-center min-h-0 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentProof.url}
                alt={`Payment Proof ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                style={{ 
                  maxHeight: 'calc(95vh - 280px)',
                  maxWidth: '100%'
                }}
                onError={(e) => {
                  console.error('Error loading image:', currentProof.url);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          ) : isPdfFile(currentProof.url) ? (
            <iframe
              src={currentProof.url}
              className="w-full h-full rounded-lg shadow-md border border-gray-300 min-h-0"
              style={{ 
                maxHeight: 'calc(95vh - 280px)',
                height: 'calc(95vh - 280px)'
              }}
              title={`Payment Proof ${currentIndex + 1} PDF`}
            />
          ) : (
            <div className="text-center p-8 bg-white rounded-lg shadow-md border border-gray-200">
              <p className="text-gray-700 text-lg font-medium mb-4">Preview not available for this file type</p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download File
              </button>
            </div>
          )}

          {/* Navigation Arrows */}
          {proofs.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 group bg-white/90 backdrop-blur-md hover:bg-white rounded-full shadow-lg hover:shadow-2xl border border-gray-200/60 hover:border-indigo-400 text-gray-600 hover:text-indigo-600 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:ring-offset-2 z-10"
                aria-label="Previous image"
              >
                <div className="w-14 h-14 flex items-center justify-center relative">
                  <svg 
                    className="w-8 h-8 transform group-hover:-translate-x-1 transition-transform duration-300 drop-shadow-sm" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      d="M15.75 19.5L8.25 12l7.5-7.5" 
                    />
                  </svg>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/5 group-hover:via-indigo-500/10 group-hover:to-transparent transition-all duration-300"></div>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 group bg-white/90 backdrop-blur-md hover:bg-white rounded-full shadow-lg hover:shadow-2xl border border-gray-200/60 hover:border-indigo-400 text-gray-600 hover:text-indigo-600 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:ring-offset-2 z-10"
                aria-label="Next image"
              >
                <div className="w-14 h-14 flex items-center justify-center relative">
                  <svg 
                    className="w-8 h-8 transform group-hover:translate-x-1 transition-transform duration-300 drop-shadow-sm" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      d="M8.25 4.5l7.5 7.5-7.5 7.5" 
                    />
                  </svg>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-l from-indigo-500/0 via-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/5 group-hover:via-indigo-500/10 group-hover:to-transparent transition-all duration-300"></div>
                </div>
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 relative flex flex-col border-t border-gray-200 bg-gray-50">
          {/* Pagination Dots - Positioned above footer content */}
          {proofs.length > 1 && (
            <div className="flex justify-center gap-2 py-2.5 border-b border-gray-200/50 bg-white/50">
              {proofs.map((_, index) => (
                <button
                  key={index}
                  className={`rounded-full transition-all duration-200 ${
                    index === currentIndex 
                      ? 'bg-indigo-600 w-8 h-2.5' 
                      : 'bg-gray-400 hover:bg-gray-500 w-2.5 h-2.5'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(index);
                  }}
                  aria-label={`View proof ${index + 1}`}
                />
              ))}
            </div>
          )}
          
          {/* Footer Content */}
          <div className="flex items-center justify-between p-3 sm:p-4 text-sm text-gray-600 bg-gray-50">
            <p className="truncate mr-4">Uploaded: {formatDate(currentProof.uploaded_at)}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-md transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
