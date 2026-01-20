'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conference } from '@/types';
import * as XLSX from 'xlsx';

type ConferenceSummary = {
  confcode: string;
  total: number;
  sizes: Record<string, number>;
};

interface TshirtSizesReportClientProps {
  initialConferences: Conference[];
  initialConfcode: string | null;
}

export default function TshirtSizesReportClient({
  initialConferences,
  initialConfcode,
}: TshirtSizesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);
  const [summary, setSummary] = useState<ConferenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const selectedConference = conferences.find((c) => c.confcode === selectedConfcode);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!selectedConfcode) {
        setSummary(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const url = new URL('/api/reports/tshirt-sizes', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to fetch t-shirt size summary');
          setSummary(null);
          return;
        }

        const confSummary = (data.conferences || []).find((c: any) => c.confcode === selectedConfcode) || null;
        setSummary(confSummary);
      } catch (err) {
        console.error('Error fetching t-shirt size summary:', err);
        setError('An error occurred while fetching t-shirt size summary');
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [selectedConfcode]);

  const handleConferenceChange = (confcode: string) => {
    setSelectedConfcode(confcode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('confcode', confcode);
    router.push(`/dashboard/reports/tshirt-sizes?${params.toString()}`);
  };

  const sizeRows = useMemo(() => {
    const sizes = summary?.sizes || {};
    const entries = Object.entries(sizes).map(([size, count]) => ({ size, count }));
    // Simple sort: put common sizes first when present, otherwise alpha
    const order = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'UNSPECIFIED'];
    entries.sort((a, b) => {
      const ai = order.indexOf(a.size.toUpperCase());
      const bi = order.indexOf(b.size.toUpperCase());
      if (ai === -1 && bi === -1) return a.size.localeCompare(b.size);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return entries;
  }, [summary]);

  const handleExportExcel = () => {
    if (!selectedConfcode || !summary || sizeRows.length === 0) return;

    setExporting(true);
    try {
      const confName = selectedConference?.name || selectedConfcode;
      const wb = XLSX.utils.book_new();
      // Layout:
      // Row 1: Conference title (merged across A:B)
      // Row 2: blank
      // Row 3: headers (Size, Count)
      // Rows 4..: data + total
      const aoa: (string | number)[][] = [
        [`Conference: ${confName}`],
        [''],
        ['T-Shirt Size', 'Count'],
        ...sizeRows.map((row) => [row.size, row.count]),
        ['TOTAL', summary.total],
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Merge A1:B1 for the title
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

      // Column widths
      ws['!cols'] = [{ wch: 18 }, { wch: 10 }];

      // Add autofilter on the header row (row index 2 -> Excel row 3)
      ws['!autofilter'] = { ref: 'A3:B3' };

      XLSX.utils.book_append_sheet(wb, ws, 'T-Shirt Sizes');

      const safeConfName = confName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeConfName}_tshirt_size_summary.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err?.message || 'Failed to export t-shirt size summary');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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
                T-Shirt Size Summary
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Counts of t-shirt sizes for approved participants (per conference)</p>
            </div>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || !summary || sizeRows.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors w-full sm:w-auto"
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
        </div>
      </div>

      {/* Conference Filter */}
      <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Conference
        </label>
        <select
          value={selectedConfcode || ''}
          onChange={(e) => handleConferenceChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 text-sm sm:text-base"
        >
          {conferences.map((conference) => (
            <option key={conference.confcode} value={conference.confcode}>
              {conference.confcode} - {conference.name || 'Unnamed Conference'}
            </option>
          ))}
        </select>
      </div>

      {/* Conference Title */}
      {selectedConference && (
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
          <h2 className="text-lg sm:text-xl font-bold text-indigo-900">
            {selectedConference.name || selectedConference.confcode}
          </h2>
          {selectedConference.name && (
            <p className="text-xs sm:text-sm text-indigo-600 mt-1">{selectedConference.confcode}</p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8 text-center">
          <p className="text-sm sm:text-base text-gray-500">Loading t-shirt size summary...</p>
        </div>
      ) : !summary || sizeRows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8 text-center">
          <p className="text-sm sm:text-base text-gray-500">No approved participants (or no t-shirt sizes recorded) for this conference.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      T-Shirt Size
                    </th>
                    <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sizeRows.map((row) => (
                    <tr key={row.size} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-4 py-3 text-sm text-gray-900 font-medium">
                        {row.size}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-700">
                      Total
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums">
                      {summary.total}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

