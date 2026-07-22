'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conference } from '@/types';
import * as XLSX from 'xlsx';
import Pagination from '@/components/Pagination';
import { formatFoodPreference } from '@/lib/food-preference';
import type { FoodPreferenceKind } from '@/lib/food-preference';

interface FoodPreferenceParticipant {
  [key: string]: any;
  registration?: {
    regid: string;
    confcode: string | null;
    status: string | null;
    province: string | null;
    lgu: string | null;
    contactperson: string | null;
    contactnum: string | null;
    email: string | null;
    regdate: string | null;
  };
}

type StatusFilter = 'PENDING' | 'APPROVED' | 'ALL';

interface FoodPreferenceReportClientProps {
  initialConferences: Conference[];
  initialConfcode: string | null;
  initialStatus: StatusFilter;
  initialPreference: FoodPreferenceKind;
}

export default function FoodPreferenceReportClient({
  initialConferences,
  initialConfcode,
  initialStatus,
  initialPreference,
}: FoodPreferenceReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [preferenceFilter, setPreferenceFilter] = useState<FoodPreferenceKind>(initialPreference);
  const [participants, setParticipants] = useState<FoodPreferenceParticipant[]>([]);
  const [total, setTotal] = useState(0);
  const [totalRegistrations, setTotalRegistrations] = useState(0);
  const [totalFoodPreferenceParticipants, setTotalFoodPreferenceParticipants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(50);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedConference = conferences.find((c) => c.confcode === selectedConfcode);

  const registrationDashboardHref = (regid: string, rowConfcode: string | null) => {
    const cc = rowConfcode || selectedConfcode || '';
    const params = new URLSearchParams();
    if (cc) params.set('confcode', cc);
    params.set('search', regid);
    params.set('openRegid', regid);
    return `/dashboard?${params.toString()}`;
  };

  const filteredParticipants = participants.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    if (q.startsWith('regid:')) return (p.registration?.regid || '').toLowerCase().includes(q.replace('regid:', '').trim());
    if (q.startsWith('province:')) return (p.province || '').toLowerCase().includes(q.replace('province:', '').trim());
    if (q.startsWith('lgu:')) return (p.lgu || '').toLowerCase().includes(q.replace('lgu:', '').trim());
    const name = [p.lastname, p.firstname, p.middleinit, p.suffix]
      .filter((v: any) => v && v !== 'N/A')
      .join(' ')
      .toLowerCase();
    return (
      name.includes(q) ||
      (p.designation || '').toLowerCase().includes(q) ||
      (p.province || '').toLowerCase().includes(q) ||
      (p.lgu || '').toLowerCase().includes(q) ||
      (p.registration?.regid || '').toLowerCase().includes(q) ||
      (p.registration?.status || '').toLowerCase().includes(q) ||
      String(p.food_preference ?? '').toLowerCase().includes(q)
    );
  });

  const totalItems = filteredParticipants.length;
  const itemsPerPageNum = itemsPerPage === 'all' ? totalItems : itemsPerPage;
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPageNum;
  const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + itemsPerPageNum;
  const paginatedData = filteredParticipants.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedConfcode, searchQuery, statusFilter, preferenceFilter]);

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus === 'PENDING' || urlStatus === 'APPROVED' || urlStatus === 'ALL') {
      setStatusFilter(urlStatus);
    }
    const urlPreference = searchParams.get('preference')?.toUpperCase();
    if (urlPreference === 'ALL' || urlPreference === 'ANY_DISH' || urlPreference === 'NON_PORK') {
      setPreferenceFilter(urlPreference);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedConfcode) {
        setParticipants([]);
        setTotal(0);
        setTotalRegistrations(0);
        setTotalFoodPreferenceParticipants(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const url = new URL('/api/reports/food-preference', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);
        url.searchParams.set('view', 'participant');
        url.searchParams.set('status', statusFilter);
        url.searchParams.set('preference', preferenceFilter);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.ok) {
          setParticipants(data.participants || []);
          setTotal(data.total || 0);
          setTotalRegistrations(data.totalRegistrations || 0);
          setTotalFoodPreferenceParticipants(data.totalFoodPreferenceParticipants || 0);
        } else {
          setError(data.error || 'Failed to fetch data');
          setParticipants([]);
          setTotal(0);
          setTotalRegistrations(0);
          setTotalFoodPreferenceParticipants(0);
        }
      } catch (err) {
        console.error('Error fetching food-preference report:', err);
        setError('An error occurred while fetching data');
        setParticipants([]);
        setTotal(0);
        setTotalRegistrations(0);
        setTotalFoodPreferenceParticipants(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedConfcode, statusFilter, preferenceFilter]);

  const pushFilters = (
    confcode: string,
    status: StatusFilter,
    preference: FoodPreferenceKind
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('confcode', confcode);
    params.set('status', status);
    params.set('preference', preference);
    router.push(`/dashboard/reports/food-preference?${params.toString()}`);
  };

  const handleConferenceChange = (confcode: string) => {
    setSelectedConfcode(confcode);
    pushFilters(confcode, statusFilter, preferenceFilter);
  };

  const handleStatusChange = (status: StatusFilter) => {
    setStatusFilter(status);
    if (selectedConfcode) {
      pushFilters(selectedConfcode, status, preferenceFilter);
    }
  };

  const handlePreferenceChange = (preference: FoodPreferenceKind) => {
    setPreferenceFilter(preference);
    if (selectedConfcode) {
      pushFilters(selectedConfcode, statusFilter, preference);
    }
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
    if (!selectedConfcode) return;

    setExporting(true);
    try {
      const confName = selectedConference?.name || selectedConfcode;
      const wb = XLSX.utils.book_new();
      const safeConfName = confName.replace(/[^a-zA-Z0-9]/g, '_');
      const statusLabel = statusFilter.toLowerCase();
      const preferenceLabel = preferenceFilter.toLowerCase();

      if (participants.length === 0) return;
      const data = participants.map((p) => ({
        'Participant Name':
          [p.lastname, p.firstname, p.middleinit, p.suffix]
            .filter((v: any) => v && v !== 'N/A')
            .join(', ') || 'N/A',
        Designation: p.designation || 'N/A',
        'Registration ID': p.registration?.regid || 'N/A',
        Status: p.registration?.status || 'N/A',
        'Food Preference': formatFoodPreference(p.food_preference) || 'N/A',
        Province: p.province || 'N/A',
        LGU: p.lgu || 'N/A',
        'Contact Number': p.contactnum || 'N/A',
        Email: p.email || 'N/A',
        'Registration Date': formatDate(p.registration?.regdate ?? null),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [
        { wch: 30 }, { wch: 45 }, { wch: 15 }, { wch: 18 }, { wch: 14 },
        { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 30 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Food Pref Parts');
      XLSX.writeFile(
        wb,
        `${safeConfName}_food_preference_${preferenceLabel}_${statusLabel}_participants.xlsx`
      );
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const hasData = participants.length > 0;
  const filteredCount = filteredParticipants.length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                Food Preference Report
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Participants with a food preference, by status
              </p>
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
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Export Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conference</label>
            <select
              value={selectedConfcode || ''}
              onChange={(e) => handleConferenceChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              {conferences.map((conference) => (
                <option key={conference.confcode} value={conference.confcode}>
                  {conference.confcode} - {conference.name || 'Unnamed Conference'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              <option value="ALL">All (Pending + Approved)</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Food Preference</label>
            <select
              value={preferenceFilter}
              onChange={(e) => handlePreferenceChange(e.target.value as FoodPreferenceKind)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              <option value="ALL">All</option>
              <option value="ANY_DISH">ANY DISH</option>
              <option value="NON_PORK">NON Pork</option>
            </select>
          </div>
        </div>
      </div>

      {!loading && (totalRegistrations > 0 || totalFoodPreferenceParticipants > 0) && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Registrations with Food Preference</p>
                <p className="text-3xl font-bold text-gray-900">{totalRegistrations}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-100 rounded-lg">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Food Preference Participants</p>
                <p className="text-3xl font-bold text-gray-900">{totalFoodPreferenceParticipants}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && hasData && (
        <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Participants
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, Reg ID, preference, province, LGU, or use regid:xxx"
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-500">
              Found {filteredCount} of {total} participants
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
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Loading food preference participants...</p>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No food preference participants found for this conference and filters.</p>
        </div>
      ) : filteredCount === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No participants match your search criteria.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-emerald-600 hover:text-emerald-800 text-sm font-medium"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed divide-y divide-gray-200">
              <colgroup>
                <col />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '7rem' }} />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '9rem' }} />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '11rem' }} />
                <col style={{ width: '10.5rem' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participant Name
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration ID
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Food Preference
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Province
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LGU
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration Date
                  </th>
                  <th className="sticky right-0 z-20 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200 bg-gray-50 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedData.map((p, index) => (
                  <tr key={`${p.regid}-${p.linenum}-${index}`} className="group hover:bg-gray-50">
                    <td className="px-2 py-2 text-sm text-gray-900 min-w-0">
                      <span
                        className="block truncate"
                        title={
                          [p.lastname, p.firstname, p.middleinit, p.suffix]
                            .filter((v: any) => v && v !== 'N/A')
                            .join(', ') || undefined
                        }
                      >
                        {[p.lastname, p.firstname, p.middleinit, p.suffix]
                          .filter((v: any) => v && v !== 'N/A')
                          .join(', ') || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-500 min-w-0">
                      <span className="block truncate" title={p.designation || undefined}>
                        {p.designation || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-emerald-700">
                      {p.registration?.regid || 'N/A'}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-700">
                      {p.registration?.status || 'N/A'}
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-700 min-w-0">
                      <span
                        className="block truncate"
                        title={formatFoodPreference(p.food_preference) || undefined}
                      >
                        {formatFoodPreference(p.food_preference) ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-500 min-w-0">
                      <span className="block truncate" title={p.province || undefined}>
                        {p.province || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-500 min-w-0">
                      <span className="block truncate" title={p.lgu || undefined}>
                        {p.lgu || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 tabular-nums">
                      {formatDate(p.registration?.regdate ?? null)}
                    </td>
                    <td className="sticky right-0 z-10 px-2 py-2 whitespace-nowrap text-sm text-center border-l border-gray-100 bg-white shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] group-hover:bg-gray-50">
                      {p.registration?.regid ? (
                        <a
                          href={registrationDashboardHref(
                            p.registration.regid,
                            p.registration?.confcode ?? null
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
                        >
                          View registration
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <Pagination
              totalItems={totalItems}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              itemLabel="participants"
            />
          </div>
        </div>
      )}
    </div>
  );
}
