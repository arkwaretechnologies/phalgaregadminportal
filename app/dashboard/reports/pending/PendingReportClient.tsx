'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conference } from '@/types';
import * as XLSX from 'xlsx';
import Pagination from '@/components/Pagination';

interface PendingRegistration {
  regid: string;
  confcode: string | null;
  province: string | null;
  lgu: string | null;
  contactperson: string | null;
  contactnum: string | null;
  email: string | null;
  regdate: string | null;
  participantCount: number;
}

interface PendingParticipant {
  [key: string]: any;
  registration?: {
    regid: string;
    confcode: string | null;
    province: string | null;
    lgu: string | null;
    contactperson: string | null;
    contactnum: string | null;
    email: string | null;
    regdate: string | null;
  };
}

type ViewMode = 'registration' | 'participant';

interface PendingReportClientProps {
  initialConferences: Conference[];
  initialConfcode: string | null;
}

export default function PendingReportClient({
  initialConferences,
  initialConfcode,
}: PendingReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);
  const [viewMode, setViewMode] = useState<ViewMode>('registration');
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [participants, setParticipants] = useState<PendingParticipant[]>([]);
  const [total, setTotal] = useState(0);
  const [totalRegistrations, setTotalRegistrations] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(50);
  const [searchQuery, setSearchQuery] = useState('');
  /** regd rows for ANC conferences (registration view search matches participant fields). */
  const [ancRegdParticipants, setAncRegdParticipants] = useState<PendingParticipant[]>([]);

  const selectedConference = conferences.find(c => c.confcode === selectedConfcode);
  const isAncConf = String(selectedConference?.is_anc ?? '').toUpperCase() === 'Y';

  /** Registrations list: search by Reg ID and open the View detail modal (see `openRegid` on dashboard). */
  const registrationDashboardHref = (regid: string, rowConfcode: string | null) => {
    const cc = rowConfcode || selectedConfcode || '';
    const params = new URLSearchParams();
    if (cc) params.set('confcode', cc);
    params.set('search', regid);
    params.set('openRegid', regid);
    return `/dashboard?${params.toString()}`;
  };

  const matchesAncRegd = (
    reg: PendingRegistration,
    predicate: (p: PendingParticipant) => boolean
  ): boolean => {
    if (!isAncConf || ancRegdParticipants.length === 0) return false;
    return ancRegdParticipants
      .filter((p) => String(p.registration?.regid ?? p.regid ?? '') === reg.regid)
      .some(predicate);
  };

  const participantFreeTextMatch = (reg: PendingRegistration, q: string): boolean =>
    matchesAncRegd(reg, (p) => {
      const name = [p.lastname, p.firstname, p.middleinit, p.suffix]
        .filter((v: any) => v && v !== 'N/A')
        .join(' ')
        .toLowerCase();
      const rid = String(p.regid ?? p.registration?.regid ?? '').toLowerCase();
      return (
        rid.includes(q) ||
        name.includes(q) ||
        String(p.province ?? '').toLowerCase().includes(q) ||
        String(p.lgu ?? '').toLowerCase().includes(q) ||
        String(p.email ?? '').toLowerCase().includes(q)
      );
    });

  // ── Filter registrations ──
  const filteredRegistrations = registrations.filter((reg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    if (q.startsWith('regid:')) {
      const sub = q.replace('regid:', '').trim();
      if ((reg.regid || '').toLowerCase().includes(sub)) return true;
      return matchesAncRegd(reg, (p) => String(p.regid ?? '').toLowerCase().includes(sub));
    }
    if (q.startsWith('province:')) {
      const sub = q.replace('province:', '').trim();
      if ((reg.province || '').toLowerCase().includes(sub)) return true;
      return matchesAncRegd(reg, (p) => String(p.province ?? '').toLowerCase().includes(sub));
    }
    if (q.startsWith('lgu:')) {
      const sub = q.replace('lgu:', '').trim();
      if ((reg.lgu || '').toLowerCase().includes(sub)) return true;
      return matchesAncRegd(reg, (p) => String(p.lgu ?? '').toLowerCase().includes(sub));
    }
    if (q.startsWith('contact:')) return (reg.contactperson || '').toLowerCase().includes(q.replace('contact:', '').trim());
    if (q.startsWith('email:')) {
      const sub = q.replace('email:', '').trim();
      if ((reg.email || '').toLowerCase().includes(sub)) return true;
      return matchesAncRegd(reg, (p) => String(p.email ?? '').toLowerCase().includes(sub));
    }

    return (
      (reg.regid || '').toLowerCase().includes(q) ||
      (reg.province || '').toLowerCase().includes(q) ||
      (reg.lgu || '').toLowerCase().includes(q) ||
      (reg.contactperson || '').toLowerCase().includes(q) ||
      (reg.email || '').toLowerCase().includes(q) ||
      (reg.contactnum || '').toLowerCase().includes(q) ||
      participantFreeTextMatch(reg, q)
    );
  });

  // ── Filter participants ──
  const filteredParticipants = participants.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    if (q.startsWith('regid:')) return (p.registration?.regid || '').toLowerCase().includes(q.replace('regid:', '').trim());
    if (q.startsWith('province:')) return (p.province || '').toLowerCase().includes(q.replace('province:', '').trim());
    if (q.startsWith('lgu:')) return (p.lgu || '').toLowerCase().includes(q.replace('lgu:', '').trim());

    const name = [p.lastname, p.firstname, p.middleinit, p.suffix].filter((v: any) => v && v !== 'N/A').join(' ').toLowerCase();
    return (
      name.includes(q) ||
      (p.designation || '').toLowerCase().includes(q) ||
      (p.province || '').toLowerCase().includes(q) ||
      (p.lgu || '').toLowerCase().includes(q) ||
      (p.registration?.regid || '').toLowerCase().includes(q) ||
      (p.registration?.contactperson || '').toLowerCase().includes(q)
    );
  });

  // ── Pagination ──
  const currentData = viewMode === 'registration' ? filteredRegistrations : filteredParticipants;
  const totalItems = currentData.length;
  const itemsPerPageNum = itemsPerPage === 'all' ? totalItems : itemsPerPage;
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPageNum;
  const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + itemsPerPageNum;
  const paginatedData = currentData.slice(startIndex, endIndex);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedConfcode, viewMode, searchQuery]);

  // ── Fetch data ──
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedConfcode) {
        setRegistrations([]);
        setParticipants([]);
        setAncRegdParticipants([]);
        setTotal(0);
        setTotalRegistrations(0);
        setTotalParticipants(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const url = new URL('/api/reports/pending', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);
        url.searchParams.set('view', viewMode);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.ok) {
          if (viewMode === 'participant') {
            setParticipants(data.participants || []);
            setRegistrations([]);
            setAncRegdParticipants([]);
          } else {
            setRegistrations(data.registrations || []);
            setParticipants([]);
            setAncRegdParticipants(data.ancRegdParticipants || []);
          }
          setTotal(data.total || 0);
          setTotalRegistrations(data.totalRegistrations || 0);
          setTotalParticipants(data.totalParticipants || 0);
        } else {
          setError(data.error || 'Failed to fetch data');
          setRegistrations([]);
          setParticipants([]);
          setAncRegdParticipants([]);
          setTotal(0);
          setTotalRegistrations(0);
          setTotalParticipants(0);
        }
      } catch (err) {
        console.error('Error fetching pending report:', err);
        setError('An error occurred while fetching data');
        setRegistrations([]);
        setParticipants([]);
        setAncRegdParticipants([]);
        setTotal(0);
        setTotalRegistrations(0);
        setTotalParticipants(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedConfcode, viewMode]);

  const handleConferenceChange = (confcode: string) => {
    setSelectedConfcode(confcode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('confcode', confcode);
    router.push(`/dashboard/reports/pending?${params.toString()}`);
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

  const formatDateOnly = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // ── Export ──
  const handleExportExcel = () => {
    if (!selectedConfcode) return;

    setExporting(true);
    try {
      const confName = selectedConference?.name || selectedConfcode;
      const wb = XLSX.utils.book_new();
      const safeConfName = confName.replace(/[^a-zA-Z0-9]/g, '_');

      if (viewMode === 'registration') {
        if (registrations.length === 0) return;
        const data = registrations.map((reg) => ({
          'Registration ID': reg.regid || 'N/A',
          'Contact Person': reg.contactperson || 'N/A',
          'Province': reg.province || 'N/A',
          'LGU': reg.lgu || 'N/A',
          'Email': reg.email || 'N/A',
          'Contact Number': reg.contactnum || 'N/A',
          'Registration Date': formatDate(reg.regdate),
          'Participant Count': reg.participantCount,
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
          { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 25 },
          { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Pending Registrations');
        XLSX.writeFile(wb, `${safeConfName}_pending_registrations.xlsx`);
      } else {
        if (participants.length === 0) return;
        const data = participants.map((p) => {
          const row: Record<string, string> = {
            'Participant Name': [p.lastname, p.firstname, p.middleinit, p.suffix].filter((v: any) => v && v !== 'N/A').join(', ') || 'N/A',
            'Designation': p.designation || 'N/A',
            'Registration ID': p.registration?.regid || 'N/A',
            'Province': p.province || 'N/A',
            'LGU': p.lgu || 'N/A',
          };
          if (isAncConf) {
            row['Contact No.'] = p.contactnum || 'N/A';
            row['Email Address'] = p.email || 'N/A';
            row['PRC No'] = p.prcnum || 'N/A';
            row['Expiry Date'] = formatDateOnly(p.expirydate);
          } else {
            row['Contact Number'] = p.contactnum || 'N/A';
            row['Email'] = p.email || 'N/A';
          }
          row['Registration Date'] = formatDate(p.registration?.regdate ?? null);
          return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = isAncConf
          ? [
              { wch: 30 }, { wch: 45 }, { wch: 15 }, { wch: 22 }, { wch: 22 },
              { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 30 },
            ]
          : [
              { wch: 30 }, { wch: 45 }, { wch: 15 }, { wch: 22 }, { wch: 22 },
              { wch: 18 }, { wch: 30 }, { wch: 30 },
            ];
        XLSX.utils.book_append_sheet(wb, ws, 'Pending Participants');
        XLSX.writeFile(wb, `${safeConfName}_pending_participants.xlsx`);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const hasData = viewMode === 'registration' ? registrations.length > 0 : participants.length > 0;
  const filteredCount = viewMode === 'registration' ? filteredRegistrations.length : filteredParticipants.length;
  const viewLabel = viewMode === 'registration' ? 'registrations' : 'participants';
  const searchPlaceholder = viewMode === 'registration'
    ? isAncConf
      ? 'Search regh or participant (Reg ID, name, province, LGU, email). Prefixes: regid:, province:, lgu:, email:, contact:'
      : 'Search by Reg ID, contact person, province, LGU, email, or use regid:xxx, province:xxx, lgu:xxx'
    : 'Search by name, designation, province, LGU, Reg ID, or use regid:xxx, province:xxx, lgu:xxx';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                All Pending Report
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">View all pending registrations or participants by conference</p>
            </div>
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || !hasData}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors w-full sm:w-auto"
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

      {/* Filters: Conference + View Mode side by side */}
      <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conference</label>
            <select
              value={selectedConfcode || ''}
              onChange={(e) => handleConferenceChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              {conferences.map((conference) => (
                <option key={conference.confcode} value={conference.confcode}>
                  {conference.confcode} - {conference.name || 'Unnamed Conference'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              <option value="registration">All Pending Registrations</option>
              <option value="participant">All Pending Participants</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && (totalRegistrations > 0 || totalParticipants > 0) && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Registrations</p>
                <p className="text-3xl font-bold text-gray-900">{totalRegistrations}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Participants</p>
                <p className="text-3xl font-bold text-gray-900">{totalParticipants}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      {!loading && hasData && (
        <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search {viewMode === 'registration' ? 'Registrations' : 'Participants'}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-gray-900"
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
              Found {filteredCount} of {total} {viewLabel}
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
          <p className="text-gray-500">Loading pending {viewLabel}...</p>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No pending {viewLabel} found for this conference.</p>
        </div>
      ) : filteredCount === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No {viewLabel} match your search criteria.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-amber-600 hover:text-amber-800 text-sm font-medium"
          >
            Clear search
          </button>
        </div>
      ) : viewMode === 'registration' ? (
        /* ── Registrations Table ── */
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed divide-y divide-gray-200">
              <colgroup>
                <col style={{ width: '7rem' }} />
                <col />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '12rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '11rem' }} />
                <col style={{ width: '6.5rem' }} />
                <col style={{ width: '10.5rem' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration ID</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Person</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Province</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LGU</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact #</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Date</th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Part.</th>
                  <th className="sticky right-0 z-20 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200 bg-gray-50 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(paginatedData as PendingRegistration[]).map((reg, index) => (
                  <tr key={`${reg.regid}-${index}`} className="group hover:bg-gray-50">
                    <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-amber-700">{reg.regid || 'N/A'}</td>
                    <td className="px-2 py-2 text-sm text-gray-900 min-w-0">
                      <span className="block truncate" title={reg.contactperson || undefined}>
                        {reg.contactperson || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-500 min-w-0">
                      <span className="block truncate" title={reg.province || undefined}>
                        {reg.province || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-500 min-w-0">
                      <span className="block truncate" title={reg.lgu || undefined}>
                        {reg.lgu || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-500 min-w-0">
                      <span className="block truncate" title={reg.email || undefined}>
                        {reg.email || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-500">{reg.contactnum || 'N/A'}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 tabular-nums">{formatDate(reg.regdate)}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {reg.participantCount}
                      </span>
                    </td>
                    <td className="sticky right-0 z-10 px-2 py-2 whitespace-nowrap text-sm text-center border-l border-gray-100 bg-white shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] group-hover:bg-gray-50">
                      {reg.regid ? (
                        <a
                          href={registrationDashboardHref(reg.regid, reg.confcode)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-sm shrink-0"
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
              itemLabel="registrations"
            />
          </div>
        </div>
      ) : (
        /* ── Participants Table ── */
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed divide-y divide-gray-200">
              <colgroup>
                <col />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '7rem' }} />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '8rem' }} />
                <col style={{ width: '7.5rem' }} />
                <col style={{ width: '12rem' }} />
                <col style={{ width: '11rem' }} />
                <col style={{ width: '10.5rem' }} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant Name</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration ID</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Province</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LGU</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact #</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Date</th>
                  <th className="sticky right-0 z-20 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200 bg-gray-50 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(paginatedData as PendingParticipant[]).map((p, index) => (
                  <tr key={`${p.regid}-${p.linenum}-${index}`} className="group hover:bg-gray-50">
                    <td className="px-2 py-2 text-sm text-gray-900 min-w-0">
                      <span className="block truncate" title={[p.lastname, p.firstname, p.middleinit, p.suffix].filter((v: any) => v && v !== 'N/A').join(', ') || undefined}>
                        {[p.lastname, p.firstname, p.middleinit, p.suffix].filter((v: any) => v && v !== 'N/A').join(', ') || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-sm text-gray-500 min-w-0">
                      <span className="block truncate" title={p.designation || undefined}>{p.designation || 'N/A'}</span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-amber-700">{p.registration?.regid || 'N/A'}</td>
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
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-500">{p.contactnum || 'N/A'}</td>
                    <td className="px-2 py-2 text-sm text-gray-500 min-w-0">
                      <span className="block truncate" title={p.email || undefined}>
                        {p.email || 'N/A'}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 tabular-nums">{formatDate(p.registration?.regdate ?? null)}</td>
                    <td className="sticky right-0 z-10 px-2 py-2 whitespace-nowrap text-sm text-center border-l border-gray-100 bg-white shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] group-hover:bg-gray-50">
                      {p.registration?.regid ? (
                        <a
                          href={registrationDashboardHref(
                            p.registration.regid,
                            p.registration?.confcode ?? null
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-sm shrink-0"
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
