'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

interface PaymentProof {
  url: string;
  uploaded_at?: string;
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
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const didMoveDuringPointerRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const currentProof = proofs[currentIndex];

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Prevent the wheel from scrolling the page while zooming in the modal.
    e.preventDefault();

    // Only zoom if Ctrl is pressed or just scroll? 
    // Usually in image viewers, scroll zooms. 
    // To prevent page scroll, we should preventDefault if we can, 
    // but React synthetic wheel events might not always allow it easily depending on passive listeners.
    // However, since this is a fixed overlay, scroll usually shouldn't scroll the background if handled correctly.
    
    const delta = e.deltaY;
    setScale((prevScale) => {
      const zoomSpeed = 0.1;
      const newScale = delta > 0 ? prevScale - zoomSpeed : prevScale + zoomSpeed;
      return Math.min(Math.max(newScale, 0.5), 5); // Limit zoom between 0.5x and 5x
    });
  }, []);

  const resetView = useCallback(() => {
    setRotation(0);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % proofs.length);
    resetView();
  }, [proofs.length, resetView]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + proofs.length) % proofs.length);
    resetView();
  }, [proofs.length, resetView]);

  const stopPanning = useCallback(() => {
    isPanningRef.current = false;
    lastPointRef.current = null;
    activePointerIdRef.current = null;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only allow panning when zoomed in (otherwise it conflicts with normal clicking).
      if (scale <= 1) return;

      e.preventDefault();
      e.stopPropagation();

      activePointerIdRef.current = e.pointerId;
      isPanningRef.current = true;
      didMoveDuringPointerRef.current = false;
      lastPointRef.current = { x: e.clientX, y: e.clientY };

      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture errors (older browsers / non-capturable targets)
      }
    },
    [scale]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    if (activePointerIdRef.current !== e.pointerId) return;
    if (scale <= 1) return;

    e.preventDefault();

    const last = lastPointRef.current;
    if (!last) {
      lastPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      didMoveDuringPointerRef.current = true;
    }
    lastPointRef.current = { x: e.clientX, y: e.clientY };

    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, [scale]);

  const handlePointerUpOrCancel = useCallback((e: React.PointerEvent) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    stopPanning();
  }, [stopPanning]);

  const handleToggleZoom = useCallback(() => {
    setScale((prev) => {
      // Toggle between 1x and 2x for a simple "click to zoom" UX.
      const next = prev <= 1 ? 2 : 1;
      return next;
    });
    // When toggling zoom, re-center the image for predictable behavior.
    setPan({ x: 0, y: 0 });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key.toLowerCase() === 'r') {
        handleRotate();
      }
    },
    [goToNext, goToPrevious, onClose, handleRotate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    // If the user zooms back out to 1x (or smaller), reset pan so the image recenters.
    if (scale <= 1 && (pan.x !== 0 || pan.y !== 0)) {
      setPan({ x: 0, y: 0 });
    }
  }, [scale, pan.x, pan.y]);

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

  const handlePrint = async () => {
    if (!currentProof?.url) return;

    try {
      // Use a hidden same-page iframe (srcdoc) so the user doesn't get navigated to a new tab.
      const url = currentProof.url;
      const isPdf = isPdfFile(url);
      const title = `Payment Proof ${currentIndex + 1}`;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.setAttribute('aria-hidden', 'true');

      // Same-origin document that can call print(), while embedding the cross-origin asset.
      iframe.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      html, body { height: 100%; margin: 0; }
      body { display: flex; align-items: center; justify-content: center; }
      img { max-width: 100%; max-height: 100%; object-fit: contain; }
      iframe, embed { width: 100vw; height: 100vh; border: 0; }
      @page { margin: 12mm; }
    </style>
  </head>
  <body>
    ${isPdf ? `<embed src="${url}" type="application/pdf" />` : `<img src="${url}" alt="${title}" />`}
    <script>
      // Give the embedded resource a moment to render before printing.
      const tryPrint = () => { try { window.focus(); window.print(); } catch (e) {} };
      window.addEventListener('load', () => setTimeout(tryPrint, 250));
      setTimeout(tryPrint, 800);
      setTimeout(tryPrint, 1600);
    </script>
  </body>
</html>`;

      document.body.appendChild(iframe);

      // Cleanup after the print dialog is closed (best-effort).
      const cleanup = () => {
        try {
          iframe.remove();
        } catch {
          // ignore
        }
      };

      // Some browsers fire afterprint on the iframe's contentWindow.
      iframe.onload = () => {
        try {
          iframe.contentWindow?.addEventListener?.('afterprint', cleanup, { once: true } as any);
        } catch {
          // ignore
        }
      };

      // Fallback cleanup in case afterprint doesn't fire.
      window.setTimeout(cleanup, 30_000);
    } catch (error) {
      console.error('Error printing file:', error);
      // Last-resort fallback: open the file (user can press Ctrl+P).
      window.open(currentProof.url, '_blank', 'noopener,noreferrer');
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
        <div 
          className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-gray-100 relative overflow-hidden min-h-0 max-h-[calc(95vh-180px)]"
          onWheel={handleWheel}
        >
          {isImageFile(currentProof.url) ? (
            <div
              className={`relative w-full h-full flex items-center justify-center min-h-0 overflow-hidden ${
                scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
              }`}
              style={{ touchAction: scale > 1 ? 'none' : 'auto' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrCancel}
              onPointerCancel={handlePointerUpOrCancel}
              onPointerLeave={handlePointerUpOrCancel}
              onClick={(e) => {
                // Avoid the "click to close" bubbling when the user is interacting with the image.
                e.stopPropagation();
                // If the user dragged to pan, don't treat mouse-up as a zoom click.
                if (didMoveDuringPointerRef.current) {
                  // Clear the flag after the "post-drag click" is ignored.
                  didMoveDuringPointerRef.current = false;
                  return;
                }
                handleToggleZoom();
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentProof.url}
                alt={`Payment Proof ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md transition-transform duration-200 ease-out origin-center"
                style={{ 
                  maxHeight: 'calc(95vh - 280px)',
                  maxWidth: '100%',
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${scale})`
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
            {currentProof.uploaded_at && (
              <p className="truncate mr-4">Uploaded: {formatDate(currentProof.uploaded_at)}</p>
            )}
            {!currentProof.uploaded_at && <div className="flex-1" />}
            <div className="flex items-center gap-2">
              {isImageFile(currentProof.url) && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetView();
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors flex-shrink-0"
                    title="Reset View"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4V4z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8m-4-4v8" />
                    </svg>
                    Reset
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotate();
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-md transition-colors flex-shrink-0"
                    title="Rotate Image (R)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rotate
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrint();
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0"
                title="Print"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 14h12v8H6z" />
                </svg>
                Print
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors flex-shrink-0"
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
    </div>
  );
}
