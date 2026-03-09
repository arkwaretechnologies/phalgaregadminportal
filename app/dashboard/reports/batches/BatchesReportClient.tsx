'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Conference } from '@/types';
import Pagination from '@/components/Pagination';
import PaymentProofImageViewer from '@/components/PaymentProofImageViewer';

interface PaymentProofItem {
  url: string;
  uploaded_at?: string;
}

interface Participant {
  [key: string]: any;
}

interface Registration {
  regid: string;
  batchnum: number | null;
  confcode: string | null;
  province: string | null;
  lgu: string | null;
  contactperson: string | null;
  contactnum: string | null;
  email: string | null;
  regdate: string | null;
}

interface Batch {
  batchnum: number;
  confcode: string | null;
  registrations: Registration[];
  registration_count: number;
  participants: Participant[];
  participant_count: number;
}

interface BatchesReportClientProps {
  initialConferences: Conference[];
  initialConfcode: string | null;
}

export default function BatchesReportClient({
  initialConferences,
  initialConfcode,
}: BatchesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences, setConferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [proofsZipLoading, setProofsZipLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null); // null = indeterminate, 0-100 = determinate
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [batchPaymentProofs, setBatchPaymentProofs] = useState<
    Record<number, { regid: string; proofs: PaymentProofItem[] }[]>
  >({});
  const [proofsLoadingBatch, setProofsLoadingBatch] = useState<number | null>(null);
  const [proofViewer, setProofViewer] = useState<{
    proofs: PaymentProofItem[];
    initialIndex: number;
    regid: string;
  } | null>(null);
  const [thumbImageErrors, setThumbImageErrors] = useState<Set<string>>(new Set());

  const selectedConference = conferences.find((c) => c.confcode === selectedConfcode);

  const isImageFile = useCallback((url: string) => url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/), []);
  const isPdfFile = useCallback((url: string) => url.toLowerCase().match(/\.pdf$/), []);

  // Load payment proofs for a batch when it is expanded
  useEffect(() => {
    if (expandedBatch == null || !batches.length) return;
    const batch = batches.find((b) => b.batchnum === expandedBatch);
    if (!batch?.registrations?.length) return;
    if (batchPaymentProofs[expandedBatch]) return; // already loaded

    setProofsLoadingBatch(expandedBatch);
    const regids = batch.registrations.map((r) => r.regid).filter(Boolean) as string[];

    Promise.all(
      regids.map((regid) =>
        fetch(`/api/registrations/${encodeURIComponent(regid)}/payment-proofs`)
          .then((res) => res.json())
          .then((data) => ({
            regid,
            proofs: Array.isArray(data?.paymentProofs) ? data.paymentProofs : [],
          }))
      )
    )
      .then((results) => {
        setBatchPaymentProofs((prev) => ({
          ...prev,
          [expandedBatch]: results.filter((r) => r.proofs.length > 0),
        }));
      })
      .catch((err) => console.error('Error loading batch payment proofs:', err))
      .finally(() => setProofsLoadingBatch(null));
  }, [expandedBatch, batches, batchPaymentProofs]);

  const handleDownloadProofsZip = async () => {
    if (!selectedConfcode) return;
    setProofsZipLoading(true);
    setDownloadProgress(null);
    setDownloadError(null);
    setError('');

    try {
      const url = `/api/reports/payment-proofs-zip?confcode=${encodeURIComponent(selectedConfcode)}`;
      const response = await fetch(url);

      if (!response.ok) {
        let msg = 'Download failed';
        try {
          const data = await response.json();
          msg = data.error || msg;
        } catch { /* ignore parse errors */ }
        setDownloadError(msg);
        setError(msg);
        return;
      }

      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (total > 0 && response.body) {
        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          setDownloadProgress(Math.round((received / total) * 100));
        }

        const blob = new Blob(chunks, { type: 'application/zip' });
        const dateStr = new Date().toISOString().slice(0, 10);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `payment-proofs-${selectedConfcode}-${dateStr}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        const blob = await response.blob();
        const dateStr = new Date().toISOString().slice(0, 10);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `payment-proofs-${selectedConfcode}-${dateStr}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      console.error('Download proofs ZIP error:', err);
      const msg = (err as Error).message || 'Failed to download payment proofs';
      setDownloadError(msg);
      setError(msg);
    } finally {
      setProofsZipLoading(false);
      setDownloadProgress(null);
    }
  };

  // Filter batches based on search term (by batch number, regid, or contactperson)
  const filteredBatches = batches.filter((batch) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();

    // Exact batch number match: "batch 2", "batch:2", or "batch: 2"
    const batchPrefixMatch = searchLower.match(/^batch[\s:]*(\d+)$/);
    if (batchPrefixMatch) {
      return batch.batchnum === parseInt(batchPrefixMatch[1], 10);
    }

    // Plain number — exact batch match only (typing "2" won't match batch 12)
    if (/^\d+$/.test(searchLower)) {
      return batch.batchnum === parseInt(searchLower, 10);
    }

    // Otherwise search by regid or contactperson
    return batch.registrations.some((reg) => {
      const regidMatch = reg.regid?.toLowerCase().includes(searchLower);
      const contactMatch = reg.contactperson?.toLowerCase().includes(searchLower);
      return regidMatch || contactMatch;
    });
  });

  // Pagination calculations (applied to filtered batches)
  const totalItems = filteredBatches.length;
  const itemsPerPageNum = itemsPerPage === 'all' ? totalItems : itemsPerPage;
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPageNum;
  const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + itemsPerPageNum;
  const paginatedBatches = filteredBatches.slice(startIndex, endIndex);

  // Reset to page 1 when conference or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedConfcode, searchTerm]);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!selectedConfcode) {
        setBatches([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const url = new URL('/api/reports/batches', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.ok) {
          setBatches(data.batches || []);
        } else {
          setError(data.error || 'Failed to fetch batches');
          setBatches([]);
        }
      } catch (err) {
        console.error('Error fetching batches:', err);
        setError('An error occurred while fetching batches');
        setBatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBatches();
  }, [selectedConfcode]);

  const handleConferenceChange = (confcode: string) => {
    setSelectedConfcode(confcode);
    setSearchTerm(''); // Clear search when changing conference
    const params = new URLSearchParams(searchParams.toString());
    params.set('confcode', confcode);
    router.push(`/dashboard/reports/batches?${params.toString()}`);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
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

  const handleExportExcel = () => {
    if (!selectedConfcode || batches.length === 0) return;

    setExporting(true);
    try {
      const confName = selectedConference?.name || selectedConfcode;
      const wb = XLSX.utils.book_new();
      const safeConfName = confName.replace(/[^a-zA-Z0-9]/g, '_');

      const regData = batches.flatMap((batch) =>
        batch.registrations.map((reg) => ({
          'Batch #': batch.batchnum,
          'Registration ID': reg.regid || 'N/A',
          'Contact Person': reg.contactperson || 'N/A',
          'LGU': reg.lgu || 'N/A',
          'Province': reg.province || 'N/A',
          'Email': reg.email || 'N/A',
          'Contact Number': reg.contactnum || 'N/A',
          'Registration Date': formatDate(reg.regdate),
        }))
      );
      const regWs = XLSX.utils.json_to_sheet(regData);
      regWs['!cols'] = [
        { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 25 },
        { wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, regWs, 'Registrations');

      const partData = batches.flatMap((batch) =>
        batch.participants.map((p) => ({
          'Batch #': batch.batchnum,
          'Participant Name': [p.lastname, p.firstname, p.middleinit, p.suffix].filter((v: any) => v && v !== 'N/A').join(', ') || 'N/A',
          'Designation': p.designation || 'N/A',
          'LGU': p.lgu || 'N/A',
          'Province': p.province || 'N/A',
        }))
      );
      const partWs = XLSX.utils.json_to_sheet(partData);
      partWs['!cols'] = [
        { wch: 10 }, { wch: 35 }, { wch: 45 }, { wch: 25 }, { wch: 25 },
      ];
      XLSX.utils.book_append_sheet(wb, partWs, 'Participants');

      XLSX.writeFile(wb, `${safeConfName}_batches_report.xlsx`);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!selectedConfcode || batches.length === 0) return;
    setPdfExporting(true);
    await new Promise((r) => setTimeout(r, 0));

    try {
      const confName = selectedConference?.name || selectedConfcode;
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;

      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];
        if (bi > 0) doc.addPage();

        const reg = batch.registrations[0];
        const lguName = reg?.lgu || '';
        const provinceName = reg?.province || '';
        const contactPerson = reg?.contactperson || '';
        const contactNum = reg?.contactnum || '';
        const participants = batch.participants || [];

        let y = 20;

        // --- HEADER ---
        // "BATCH NO." label + large batch number (top-right)
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('BATCH NO.', pageWidth - margin, y, { align: 'right' });
        doc.setFontSize(28);
        doc.text(String(batch.batchnum), pageWidth - margin, y + 10, { align: 'right' });

        // Org name (centered)
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(
          'Philippine Association of Local Government Accounts',
          pageWidth / 2,
          y,
          { align: 'center' }
        );

        y += 7;
        // Conference name + batch (centered, bold)
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${confName} - BATCH ${batch.batchnum}`, pageWidth / 2, y, {
          align: 'center',
        });

        y += 10;

        // --- SUB-HEADER ---
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const lguLabel = 'LGU :   ';
        doc.text(lguLabel, margin, y);
        doc.setFont('helvetica', 'bold');
        const lguValue = [lguName, provinceName].filter(Boolean).join(', ');
        doc.text(lguValue, margin + doc.getTextWidth(lguLabel), y);

        doc.setFont('helvetica', 'normal');
        doc.text('Date :', pageWidth / 2 + 30, y);

        y += 3;

        // --- TABLE ---
        const tableBody = participants.map((p: any, i: number) => {
          const nameParts = [p.firstname, p.middleinit].filter(
            (v: string) => v && v.trim()
          );
          const fullName = p.lastname
            ? `${p.lastname}, ${nameParts.join(' ')}`
            : nameParts.join(' ');
          const suffix =
            p.suffix && p.suffix !== 'N/A' ? ` ${p.suffix}` : '';
          const brgy = p.brgy && p.brgy.trim() ? p.brgy.trim() : '';
          const bgyLgu = `${brgy}, ${p.lgu || lguName}`;

          return [
            `${i + 1}.`,
            (fullName + suffix).toUpperCase(),
            bgyLgu.toUpperCase(),
            '',
            p.tshirtsize || '',
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [['', 'Name', 'Barangay/LGU', 'OR No.', 'T-Shirt Size']],
          body: tableBody,
          theme: 'plain',
          styles: {
            fontSize: 9,
            cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
            textColor: [0, 0, 0],
          },
          headStyles: { fontStyle: 'bold', fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 10, halign: 'right' },
            1: { cellWidth: 55 },
            2: { cellWidth: 55 },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 25, halign: 'center' },
          },
          margin: { left: margin, right: margin },
          didDrawCell: (data: any) => {
            if (data.section === 'head') {
              doc.setDrawColor(0);
              doc.setLineWidth(0.3);
              doc.line(
                data.cell.x,
                data.cell.y + data.cell.height,
                data.cell.x + data.cell.width,
                data.cell.y + data.cell.height
              );
            }
            if (data.section === 'body') {
              doc.setDrawColor(180);
              doc.setLineWidth(0.1);
              doc.line(
                data.cell.x,
                data.cell.y + data.cell.height,
                data.cell.x + data.cell.width,
                data.cell.y + data.cell.height
              );
            }
          },
        });

        // --- FOOTER ---
        const finalY = (doc as any).lastAutoTable.finalY + 8;

        // T-shirt size counts (bottom-left)
        const sizeCounts: Record<string, number> = {};
        participants.forEach((p: any) => {
          if (p.tshirtsize) {
            sizeCounts[p.tshirtsize] = (sizeCounts[p.tshirtsize] || 0) + 1;
          }
        });

        let sizeY = finalY;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        Object.entries(sizeCounts)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([size, count]) => {
            doc.text(size, margin + 5, sizeY);
            doc.text(String(count), margin + 18, sizeY);
            sizeY += 4;
          });

        // Total (center-bottom)
        const totalY = Math.max(sizeY + 4, finalY + 18);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total : ${participants.length}`, pageWidth / 2 - 10, totalY);

        // Received By (right side)
        const rcvLabelX = pageWidth / 2 + 10;
        const nameStartX = rcvLabelX + 28;
        const lineEndX = pageWidth - margin;
        const sigMidX = (nameStartX - 5 + lineEndX) / 2;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Received By:', rcvLabelX, finalY);

        doc.setFont('helvetica', 'bold');
        doc.text(contactPerson.toUpperCase(), nameStartX, finalY);

        // Signature line
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(nameStartX - 5, finalY + 3, lineEndX, finalY + 3);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text('Signature over printed name', sigMidX, finalY + 7, {
          align: 'center',
        });

        doc.setFont('helvetica', 'normal');
        doc.text(`Contact No. ${contactNum}`, sigMidX, finalY + 11, {
          align: 'center',
        });
      }

      const safeConfName = (confName || '').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`${safeConfName}_batch_report.pdf`);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setError(err.message || 'Failed to export PDF');
    } finally {
      setPdfExporting(false);
    }
  };

  // Calculate total accepted participants across all batches
  const totalAcceptedParticipants = batches.reduce((sum, batch) => sum + batch.participant_count, 0);
  
  // Calculate filtered totals when search is active
  const filteredAcceptedParticipants = filteredBatches.reduce((sum, batch) => sum + batch.participant_count, 0);
  const isSearchActive = searchTerm.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Download progress overlay */}
      {(proofsZipLoading || downloadError) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            {proofsZipLoading ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Downloading payment proofs</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {downloadProgress != null
                    ? 'Downloading...'
                    : 'Preparing ZIP on server. For large conferences this can take 2–5 minutes.'}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    {downloadProgress != null ? (
                      <div
                        className="h-full bg-indigo-600 transition-all duration-150 ease-out rounded-full"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    ) : (
                      <div className="h-full w-2/3 min-w-[120px] bg-indigo-500 animate-pulse rounded-full" />
                    )}
                  </div>
                  {downloadProgress != null && (
                    <span className="text-sm font-bold text-indigo-600 tabular-nums min-w-[3ch]">
                      {downloadProgress}%
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Download failed</h3>
                <p className="text-sm text-gray-600 mb-4">{downloadError}</p>
                <button
                  type="button"
                  onClick={() => setDownloadError(null)}
                  className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                Per Batch Number
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">View approved registrations organized by batch number</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              disabled={exporting || loading || batches.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors flex-1 sm:flex-none"
            >
              {exporting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export Excel</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={pdfExporting || loading || batches.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors flex-1 sm:flex-none"
            >
              {pdfExporting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Batch Report (PDF)</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownloadProofsZip}
              disabled={proofsZipLoading || loading || !selectedConfcode}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors flex-1 sm:flex-none"
            >
              {proofsZipLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download all payment proofs (ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Conference Filter and Search */}
      <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conference
            </label>
            <select
              value={selectedConfcode || ''}
              onChange={(e) => handleConferenceChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
            >
              {conferences.map((conference) => (
                <option key={conference.confcode} value={conference.confcode}>
                  {conference.confcode} - {conference.name || 'Unnamed Conference'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by Batch Number, Reg ID, or Contact Person
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter batch number (e.g. 2 or batch 2), Reg ID, or Contact Person..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {!loading && batches.length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {isSearchActive ? 'Matching Batches' : 'Total Batches'}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {isSearchActive ? (
                    <>
                      {filteredBatches.length}
                      <span className="text-sm font-normal text-gray-500 ml-2">of {batches.length}</span>
                    </>
                  ) : (
                    batches.length
                  )}
                </p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {isSearchActive ? 'Matching Participants' : 'Total Accepted Participants'}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {isSearchActive ? (
                    <>
                      {filteredAcceptedParticipants}
                      <span className="text-sm font-normal text-gray-500 ml-2">of {totalAcceptedParticipants}</span>
                    </>
                  ) : (
                    totalAcceptedParticipants
                  )}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Loading batches...</p>
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No batches found for this conference.</p>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <div className="flex flex-col items-center">
            <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-gray-500 mb-2">No batches match your search criteria.</p>
            <p className="text-sm text-gray-400">Try searching for a different batch number, Reg ID, or Contact Person name.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Clear Search
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pagination at top */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
            <Pagination
              totalItems={totalItems}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              itemLabel="batches"
            />
          </div>

          {paginatedBatches.map((batch) => (
            <div
              key={batch.batchnum}
              className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setExpandedBatch(expandedBatch === batch.batchnum ? null : batch.batchnum)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-semibold">
                    Batch {batch.batchnum}
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-gray-500">
                      {batch.registration_count} Registration{batch.registration_count !== 1 ? 's' : ''} • {batch.participant_count} Participant{batch.participant_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-1.5 flex-1 justify-end min-w-0 mx-2"
                  onClick={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  {proofsLoadingBatch === batch.batchnum ? (
                    <span className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
                      Proofs…
                    </span>
                  ) : (
                    (batchPaymentProofs[batch.batchnum] || []).flatMap(({ regid, proofs }) =>
                      proofs.map((proof, idx) => {
                        const isImage = isImageFile(proof.url);
                        const isPdf = isPdfFile(proof.url);
                        const imageFailed = thumbImageErrors.has(proof.url);
                        const showThumb = isImage && !imageFailed;
                        return (
                          <button
                            key={`${regid}-${idx}-${proof.url}`}
                            type="button"
                            className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-200 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            onClick={() =>
                              setProofViewer({ proofs, initialIndex: idx, regid })
                            }
                            title={`Payment proof ${idx + 1} (${regid})`}
                          >
                            {showThumb ? (
                              <img
                                src={proof.url}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={() =>
                                  setThumbImageErrors((prev) => new Set(prev).add(proof.url))
                                }
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                {isPdf ? (
                                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })
                    )
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ease-in-out ${
                    expandedBatch === batch.batchnum ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  expandedBatch === batch.batchnum
                    ? 'max-h-[8000px] opacity-100'
                    : 'max-h-0 opacity-0'
                }`}
                style={{
                  transitionProperty: 'max-height, opacity',
                }}
              >
                <div className="border-t border-gray-200">
                  <div
                    className={`p-6 transition-all duration-500 ease-in-out ${
                      expandedBatch === batch.batchnum
                        ? 'translate-y-0 opacity-100 delay-75'
                        : '-translate-y-2 opacity-0'
                    }`}
                    style={{
                      transitionProperty: 'transform, opacity',
                    }}
                  >
                    {/* Registrations */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Registrations</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Registration ID
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Contact Person
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Province/LGU
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Registration Date
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {batch.registrations.map((reg) => (
                              <tr key={reg.regid} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {reg.regid}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {reg.contactperson || 'N/A'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {[reg.province, reg.lgu].filter(Boolean).join(' / ') || 'N/A'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {formatDate(reg.regdate)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Participants */}
                    {batch.participants.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Participants</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Name
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Designation
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Province/LGU
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {batch.participants.map((participant, index) => (
                                <tr key={`${participant.regid}-${participant.linenum}-${index}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                    {[participant.lastname, participant.firstname, participant.middleinit, participant.suffix]
                                      .filter((v: any) => v && v !== 'N/A')
                                      .join(', ') || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {participant.designation || 'N/A'}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {[participant.province, participant.lgu].filter(Boolean).join(' / ') || 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {proofViewer && (
        <PaymentProofImageViewer
          proofs={proofViewer.proofs}
          initialIndex={proofViewer.initialIndex}
          onClose={() => setProofViewer(null)}
          regid={proofViewer.regid}
        />
      )}
    </div>
  );
}
