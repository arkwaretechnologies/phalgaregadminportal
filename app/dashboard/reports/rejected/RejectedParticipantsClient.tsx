'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conference } from '@/types';
import * as XLSX from 'xlsx';
import Pagination from '@/components/Pagination';

interface RejectedRegistration {
  regid: string;
  batchnum?: number | null;
  confcode?: string | null;
  province?: string | null;
  lgu?: string | null;
  contactperson?: string | null;
  contactnum?: string | null;
  email?: string | null;
  regdate?: string | null;
  remarks?: string | null;
  participantCount: number;
}

interface Participant {
  [key: string]: any;
  registration?: {
    regid: string;
    batchnum: number | null;
    confcode: string | null;
    province: string | null;
    lgu: string | null;
    contactperson: string | null;
    contactnum: string | null;
    email: string | null;
    regdate: string | null;
    remarks: string | null;
  };
}

type ViewMode = 'registration' | 'participant';

interface RejectedParticipantsClientProps {
  initialConferences: Conference[];
  initialConfcode: string | null;
}

export default function RejectedParticipantsClient({
  initialConferences,
  initialConfcode,
}: RejectedParticipantsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences, setConferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);
  const [viewMode, setViewMode] = useState<ViewMode>('registration');
  const [registrations, setRegistrations] = useState<RejectedRegistration[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [totalRegistrations, setTotalRegistrations] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(50);
  const [searchQuery, setSearchQuery] = useState('');

  // Get the selected conference object
  const selectedConference = conferences.find(c => c.confcode === selectedConfcode);

  // Filter registrations based on search query
  const filteredRegistrations = registrations.filter((reg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    if (q.startsWith('regid:')) return (reg.regid || '').toLowerCase().includes(q.replace('regid:', '').trim());
    if (q.startsWith('province:')) return (reg.province || '').toLowerCase().includes(q.replace('province:', '').trim());
    if (q.startsWith('lgu:')) return (reg.lgu || '').toLowerCase().includes(q.replace('lgu:', '').trim());
    if (q.startsWith('contact:')) return (reg.contactperson || '').toLowerCase().includes(q.replace('contact:', '').trim());
    if (q.startsWith('email:')) return (reg.email || '').toLowerCase().includes(q.replace('email:', '').trim());
    if (q.startsWith('remarks:')) return (reg.remarks || '').toLowerCase().includes(q.replace('remarks:', '').trim());

    return (
      (reg.regid || '').toLowerCase().includes(q) ||
      (reg.province || '').toLowerCase().includes(q) ||
      (reg.lgu || '').toLowerCase().includes(q) ||
      (reg.contactperson || '').toLowerCase().includes(q) ||
      (reg.email || '').toLowerCase().includes(q) ||
      (reg.contactnum || '').toLowerCase().includes(q) ||
      (reg.remarks || '').toLowerCase().includes(q)
    );
  });

  // Filter participants based on search query
  const filteredParticipants = participants.filter((participant) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    
    // Support prefix searches like "regid:01035573" or "province:sarangani"
    if (query.startsWith('regid:')) {
      const regidQuery = query.replace('regid:', '').trim();
      const regid = (participant.registration?.regid || '').toLowerCase();
      return regid.includes(regidQuery);
    }
    if (query.startsWith('province:')) {
      const provinceQuery = query.replace('province:', '').trim();
      const province = (participant.province || '').toLowerCase();
      return province.includes(provinceQuery);
    }
    if (query.startsWith('lgu:')) {
      const lguQuery = query.replace('lgu:', '').trim();
      const lgu = (participant.lgu || '').toLowerCase();
      return lgu.includes(lguQuery);
    }
    if (query.startsWith('remarks:')) {
      const remarksQuery = query.replace('remarks:', '').trim();
      const remarks = (participant.registration?.remarks || '').toLowerCase();
      return remarks.includes(remarksQuery);
    }
    
    // General search across all fields
    const name = [participant.lastname, participant.firstname, participant.middleinit]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const designation = (participant.designation || '').toLowerCase();
    const province = (participant.province || '').toLowerCase();
    const lgu = (participant.lgu || '').toLowerCase();
    const regid = (participant.registration?.regid || '').toLowerCase();
    const remarks = (participant.registration?.remarks || '').toLowerCase();
    
    return (
      name.includes(query) ||
      designation.includes(query) ||
      province.includes(query) ||
      lgu.includes(query) ||
      regid.includes(query) ||
      remarks.includes(query)
    );
  });

  // Pagination calculations
  const currentData = viewMode === 'registration' ? filteredRegistrations : filteredParticipants;
  const totalItems = currentData.length;
  const itemsPerPageNum = itemsPerPage === 'all' ? totalItems : itemsPerPage;
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPageNum;
  const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + itemsPerPageNum;
  const paginatedData = currentData.slice(startIndex, endIndex);

  // Reset to page 1 when conference, view, or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedConfcode, viewMode, searchQuery]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedConfcode) {
        setRegistrations([]);
        setParticipants([]);
        setTotalRegistrations(0);
        setTotalParticipants(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const url = new URL('/api/reports/rejected', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);
        url.searchParams.set('view', viewMode);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.ok) {
          if (viewMode === 'participant') {
            setParticipants(data.participants || []);
            setRegistrations([]);
          } else {
            setRegistrations(data.registrations || []);
            setParticipants([]);
          }
          setTotalRegistrations(data.totalRegistrations || 0);
          setTotalParticipants(data.totalParticipants || 0);
        } else {
          setError(data.error || 'Failed to fetch data');
          setRegistrations([]);
          setParticipants([]);
          setTotalRegistrations(0);
          setTotalParticipants(0);
        }
      } catch (err) {
        console.error('Error fetching rejected report:', err);
        setError('An error occurred while fetching data');
        setRegistrations([]);
        setParticipants([]);
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
    router.push(`/dashboard/reports/rejected?${params.toString()}`);
  };

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
          'Registration Date': formatDate(reg.regdate ?? null),
          'Participant Count': reg.participantCount,
          'Rejection Remarks': reg.remarks || 'N/A',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
          { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 25 },
          { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 50 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Rejected Registrations');
        XLSX.writeFile(wb, `${safeConfName}_rejected_registrations.xlsx`);
      } else {
        if (participants.length === 0) return;
        const data = participants.map((participant) => ({
          'Participant Name': [participant.lastname, participant.firstname, participant.middleinit]
            .filter(Boolean)
            .join(', ') || 'N/A',
          'Designation': participant.designation || 'N/A',
          'Registration ID': participant.registration?.regid || 'N/A',
          'Province/LGU': [participant.province, participant.lgu].filter(Boolean).join(' / ') || 'N/A',
          'Registration Date': formatDate(participant.registration?.regdate ?? null),
          'Rejection Remarks': participant.registration?.remarks || 'N/A',
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
          { wch: 25 }, { wch: 45 }, { wch: 15 }, { wch: 40 },
          { wch: 30 }, { wch: 50 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Rejected Participants');
        XLSX.writeFile(wb, `${safeConfName}_rejected_participants.xlsx`);
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
    ? 'Search by Reg ID, contact person, province, LGU, email, remarks, or use regid:xxx, province:xxx, lgu:xxx, remarks:xxx'
    : 'Search by name, designation, province, LGU, Reg ID, or use regid:xxx, province:xxx, lgu:xxx, remarks:xxx';

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

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                All Rejected Registrations
              </h1>
              <p className="text-gray-600 mt-1">View all rejected/unsuccessful registrations or participants by conference</p>
            </div>
          </div>
          
          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || !hasData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 text-sm sm:text-base"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              <option value="registration">All Rejected Registrations</option>
              <option value="participant">All Rejected Participants</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && (totalRegistrations > 0 || totalParticipants > 0) && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Rejected Registrations</p>
                <p className="text-3xl font-bold text-gray-900">{totalRegistrations}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-100 rounded-lg">
                <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Rejected Participants</p>
                <p className="text-3xl font-bold text-gray-900">{totalParticipants}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conference Title */}
      {selectedConference && (
        <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border border-red-100">
          <h2 className="text-xl font-bold text-red-900">
            {selectedConference.name || selectedConference.confcode}
          </h2>
          {selectedConference.name && (
            <p className="text-sm text-red-600 mt-1">{selectedConference.confcode}</p>
          )}
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
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 bg-white text-gray-900"
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
              Found {filteredCount} of {viewMode === 'registration' ? registrations.length : participants.length} {viewLabel}
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
          <p className="text-gray-500">Loading {viewLabel}...</p>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No rejected {viewLabel} found for this conference.</p>
        </div>
      ) : filteredCount === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No {viewLabel} match your search criteria.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Clear search
          </button>
        </div>
      ) : viewMode === 'registration' ? (
        /* ── Registrations Table ── */
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Person</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Province / LGU</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Number</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Date</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rejection Remarks</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(paginatedData as RejectedRegistration[]).map((reg, index) => (
                  <tr key={`${reg.regid}-${index}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-red-700">{reg.regid || 'N/A'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{reg.contactperson || 'N/A'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{[reg.province, reg.lgu].filter(Boolean).join(' / ') || 'N/A'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{reg.email || 'N/A'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{reg.contactnum || 'N/A'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{formatDate(reg.regdate ?? null)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {reg.participantCount}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-red-600 max-w-xs truncate" title={reg.remarks || ''}>
                      {reg.remarks || 'N/A'}
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participant Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Designation
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Province/LGU
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rejection Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(paginatedData as Participant[]).map((participant, index) => (
                  <tr key={`${participant.regid}-${participant.linenum}-${index}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {[participant.lastname, participant.firstname, participant.middleinit]
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {participant.designation || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {participant.registration?.regid || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {[participant.province, participant.lgu].filter(Boolean).join(' / ') || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(participant.registration?.regdate ?? null)}
                    </td>
                    <td className="px-3 py-2 text-sm text-red-600 max-w-xs truncate" title={participant.registration?.remarks || ''}>
                      {participant.registration?.remarks || 'N/A'}
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
