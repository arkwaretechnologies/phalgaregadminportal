'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conference } from '@/types';
import * as XLSX from 'xlsx';
import Pagination from '@/components/Pagination';

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(50);
  const [searchQuery, setSearchQuery] = useState('');

  // Get the selected conference object
  const selectedConference = conferences.find(c => c.confcode === selectedConfcode);

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
  const totalItems = filteredParticipants.length;
  const itemsPerPageNum = itemsPerPage === 'all' ? totalItems : itemsPerPage;
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPageNum;
  const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + itemsPerPageNum;
  const paginatedParticipants = filteredParticipants.slice(startIndex, endIndex);

  // Reset to page 1 when conference or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedConfcode, searchQuery]);

  useEffect(() => {
    const fetchParticipants = async () => {
      if (!selectedConfcode) {
        setParticipants([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const url = new URL('/api/reports/rejected', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.ok) {
          setParticipants(data.participants || []);
        } else {
          setError(data.error || 'Failed to fetch participants');
          setParticipants([]);
        }
      } catch (err) {
        console.error('Error fetching participants:', err);
        setError('An error occurred while fetching participants');
        setParticipants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [selectedConfcode]);

  const handleConferenceChange = (confcode: string) => {
    setSelectedConfcode(confcode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('confcode', confcode);
    router.push(`/dashboard/reports/rejected?${params.toString()}`);
  };

  const handleExportExcel = () => {
    if (!selectedConfcode || participants.length === 0) return;
    
    setExporting(true);
    try {
      // Build data from exactly what's displayed on the page
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
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Set column widths for better presentation
      ws['!cols'] = [
        { wch: 25 },  // Participant Name
        { wch: 45 },  // Designation
        { wch: 15 },  // Registration ID
        { wch: 40 },  // Province/LGU
        { wch: 30 },  // Registration Date
        { wch: 50 },  // Rejection Remarks
      ];
      
      // Add the worksheet to workbook
      const confName = selectedConference?.name || selectedConfcode;
      XLSX.utils.book_append_sheet(wb, ws, 'Rejected Participants');
      
      // Generate filename
      const safeConfName = confName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeConfName}_rejected_participants.xlsx`;
      
      // Export the file
      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export participants');
    } finally {
      setExporting(false);
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
              <p className="text-gray-600 mt-1">View all rejected/unsuccessful registrations by conference</p>
            </div>
          </div>
          
          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || participants.length === 0}
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

      {/* Conference Filter */}
      <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Conference
        </label>
        <select
          value={selectedConfcode || ''}
          onChange={(e) => handleConferenceChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 bg-white text-gray-900"
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
      {!loading && participants.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Participants
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
              placeholder="Search by name, designation, or use regid:xxx, province:xxx, lgu:xxx, remarks:xxx"
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
              Found {filteredParticipants.length} of {participants.length} participants
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
          <p className="text-gray-500">Loading participants...</p>
        </div>
      ) : participants.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No rejected registrations found for this conference.</p>
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No participants match your search criteria.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Clear search
          </button>
        </div>
      ) : (
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
                {paginatedParticipants.map((participant, index) => (
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
