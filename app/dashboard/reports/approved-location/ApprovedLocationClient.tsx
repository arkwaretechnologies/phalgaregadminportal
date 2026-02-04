'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conference } from '@/types';
import * as XLSX from 'xlsx';
import Pagination from '@/components/Pagination';

type ProvinceData = {
  province: string;
  count: number;
};

type LguData = {
  province: string;
  lgu: string;
  count: number;
};

type CountByMode = 'batch' | 'participant';

interface ApprovedLocationClientProps {
  initialConferences: Conference[];
  initialConfcode: string | null;
}

export default function ApprovedLocationClient({
  initialConferences,
  initialConfcode,
}: ApprovedLocationClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);
  const [provinceData, setProvinceData] = useState<ProvinceData[]>([]);
  const [lguData, setLguData] = useState<LguData[]>([]);
  const [totalApproved, setTotalApproved] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'province' | 'lgu'>('province');
  const [countBy, setCountBy] = useState<CountByMode>('batch');
  
  // Pagination state for Province tab
  const [provinceCurrentPage, setProvinceCurrentPage] = useState(1);
  const [provinceItemsPerPage, setProvinceItemsPerPage] = useState<number | 'all'>(50);
  
  // Pagination state for LGU tab
  const [lguCurrentPage, setLguCurrentPage] = useState(1);
  const [lguItemsPerPage, setLguItemsPerPage] = useState<number | 'all'>(50);

  const selectedConference = conferences.find((c) => c.confcode === selectedConfcode);

  // Province pagination calculations
  const provinceTotalItems = provinceData.length;
  const provinceItemsPerPageNum = provinceItemsPerPage === 'all' ? provinceTotalItems : provinceItemsPerPage;
  const provinceStartIndex = provinceItemsPerPage === 'all' ? 0 : (provinceCurrentPage - 1) * provinceItemsPerPageNum;
  const provinceEndIndex = provinceItemsPerPage === 'all' ? provinceTotalItems : provinceStartIndex + provinceItemsPerPageNum;
  const paginatedProvinceData = provinceData.slice(provinceStartIndex, provinceEndIndex);

  // LGU pagination calculations
  const lguTotalItems = lguData.length;
  const lguItemsPerPageNum = lguItemsPerPage === 'all' ? lguTotalItems : lguItemsPerPage;
  const lguStartIndex = lguItemsPerPage === 'all' ? 0 : (lguCurrentPage - 1) * lguItemsPerPageNum;
  const lguEndIndex = lguItemsPerPage === 'all' ? lguTotalItems : lguStartIndex + lguItemsPerPageNum;
  const paginatedLguData = lguData.slice(lguStartIndex, lguEndIndex);

  // Reset pagination when conference or countBy changes
  useEffect(() => {
    setProvinceCurrentPage(1);
    setLguCurrentPage(1);
  }, [selectedConfcode, countBy]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedConfcode) {
        setProvinceData([]);
        setLguData([]);
        setTotalApproved(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const url = new URL('/api/reports/approved-location', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);
        url.searchParams.set('countBy', countBy);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to fetch approved location data');
          setProvinceData([]);
          setLguData([]);
          setTotalApproved(0);
          return;
        }

        setProvinceData(data.provinceData || []);
        setLguData(data.lguData || []);
        setTotalApproved(data.totalApproved || 0);
      } catch (err) {
        console.error('Error fetching approved location data:', err);
        setError('An error occurred while fetching approved location data');
        setProvinceData([]);
        setLguData([]);
        setTotalApproved(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedConfcode, countBy]);

  const handleConferenceChange = (confcode: string) => {
    setSelectedConfcode(confcode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('confcode', confcode);
    router.push(`/dashboard/reports/approved-location?${params.toString()}`);
  };

  const handleCountByChange = (mode: CountByMode) => {
    setCountBy(mode);
  };

  const countByLabel = countBy === 'batch' ? 'Batches' : 'Participants';
  const countByLabelSingular = countBy === 'batch' ? 'Batch' : 'Participant';

  const handleExportExcel = () => {
    if (!selectedConfcode || (provinceData.length === 0 && lguData.length === 0)) return;

    setExporting(true);
    try {
      const confName = selectedConference?.name || selectedConfcode;
      const wb = XLSX.utils.book_new();
      const safeConfName = confName.replace(/[^a-zA-Z0-9]/g, '_');

      if (activeTab === 'province') {
        // Export Province data only
        const provinceAoa: (string | number)[][] = [
          [`Conference: ${confName}`],
          [`Count By: ${countByLabel}`],
          [''],
          ['Approved by Province'],
          [''],
          ['Province', `${countByLabelSingular} Count`],
          ...provinceData.map((row) => [row.province, row.count]),
          ['TOTAL', totalApproved],
        ];

        const wsProvince = XLSX.utils.aoa_to_sheet(provinceAoa);
        wsProvince['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
          { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
        ];
        wsProvince['!cols'] = [{ wch: 35 }, { wch: 18 }];
        wsProvince['!autofilter'] = { ref: 'A6:B6' };

        XLSX.utils.book_append_sheet(wb, wsProvince, 'By Province');

        const filename = `${safeConfName}_approved_by_province_${countBy}.xlsx`;
        XLSX.writeFile(wb, filename);
      } else {
        // Export LGU data only
        const lguAoa: (string | number)[][] = [
          [`Conference: ${confName}`],
          [`Count By: ${countByLabel}`],
          [''],
          ['Approved by LGU'],
          [''],
          ['Province', 'LGU', `${countByLabelSingular} Count`],
          ...lguData.map((row) => [row.province, row.lgu, row.count]),
          ['TOTAL', '', totalApproved],
        ];

        const wsLgu = XLSX.utils.aoa_to_sheet(lguAoa);
        wsLgu['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
          { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
        ];
        wsLgu['!cols'] = [{ wch: 35 }, { wch: 35 }, { wch: 18 }];
        wsLgu['!autofilter'] = { ref: 'A6:C6' };

        XLSX.utils.book_append_sheet(wb, wsLgu, 'By LGU');

        const filename = `${safeConfName}_approved_by_lgu_${countBy}.xlsx`;
        XLSX.writeFile(wb, filename);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err?.message || 'Failed to export approved location data');
    } finally {
      setExporting(false);
    }
  };

  const hasData = provinceData.length > 0 || lguData.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                Approved by Location
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Approved registrations by Province and LGU</p>
            </div>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || !hasData}
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

      {/* Filters */}
      <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Conference Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conference
            </label>
            <select
              value={selectedConfcode || ''}
              onChange={(e) => handleConferenceChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              {conferences.map((conference) => (
                <option key={conference.confcode} value={conference.confcode}>
                  {conference.confcode} - {conference.name || 'Unnamed Conference'}
                </option>
              ))}
            </select>
          </div>

          {/* Count By Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Count By
            </label>
            <select
              value={countBy}
              onChange={(e) => handleCountByChange(e.target.value as CountByMode)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              <option value="batch">By Batch (Registration)</option>
              <option value="participant">By Participant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Conference Title */}
      {selectedConference && (
        <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-100">
          <h2 className="text-lg sm:text-xl font-bold text-teal-900">
            {selectedConference.name || selectedConference.confcode}
          </h2>
          {selectedConference.name && (
            <p className="text-xs sm:text-sm text-teal-600 mt-1">{selectedConference.confcode}</p>
          )}
          {!loading && (
            <p className="text-sm text-teal-700 mt-2">
              Total Approved {countByLabel}: <span className="font-bold">{totalApproved}</span>
            </p>
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
          <p className="text-sm sm:text-base text-gray-500">Loading approved location data...</p>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8 text-center">
          <p className="text-sm sm:text-base text-gray-500">No approved {countBy === 'batch' ? 'registrations' : 'participants'} found for this conference.</p>
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="mb-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('province')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'province'
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                By Province ({provinceData.length})
              </button>
              <button
                onClick={() => setActiveTab('lgu')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'lgu'
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                By LGU ({lguData.length})
              </button>
            </nav>
          </div>

          {/* Province Table */}
          {activeTab === 'province' && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Province
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {countByLabelSingular} Count
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedProvinceData.map((row) => (
                        <tr key={row.province} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-3 text-sm text-gray-900 font-medium">
                            {row.province}
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
                          {totalApproved}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                <Pagination
                  totalItems={provinceTotalItems}
                  currentPage={provinceCurrentPage}
                  itemsPerPage={provinceItemsPerPage}
                  onPageChange={setProvinceCurrentPage}
                  onItemsPerPageChange={setProvinceItemsPerPage}
                  itemLabel="provinces"
                />
              </div>
            </div>
          )}

          {/* LGU Table */}
          {activeTab === 'lgu' && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Province
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          LGU
                        </th>
                        <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {countByLabelSingular} Count
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedLguData.map((row, idx) => (
                        <tr key={`${row.province}-${row.lgu}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-3 text-sm text-gray-900 font-medium">
                            {row.province}
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">
                            {row.lgu}
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                            {row.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={2} className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-700">
                          Total
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums">
                          {totalApproved}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                <Pagination
                  totalItems={lguTotalItems}
                  currentPage={lguCurrentPage}
                  itemsPerPage={lguItemsPerPage}
                  onPageChange={setLguCurrentPage}
                  onItemsPerPageChange={setLguItemsPerPage}
                  itemLabel="LGUs"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
