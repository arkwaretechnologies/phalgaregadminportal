'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conference } from '@/types';
import * as XLSX from 'xlsx';

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
  };
}

interface ApprovedParticipantsClientProps {
  initialConferences: Conference[];
  initialConfcode: string | null;
}

export default function ApprovedParticipantsClient({
  initialConferences,
  initialConfcode,
}: ApprovedParticipantsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences, setConferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Get the selected conference object
  const selectedConference = conferences.find(c => c.confcode === selectedConfcode);

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
        const url = new URL('/api/reports/participants', window.location.origin);
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
    router.push(`/dashboard/reports/participants?${params.toString()}`);
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
        'Batch #': participant.registration?.batchnum || 'N/A',
        'Registration ID': participant.registration?.regid || 'N/A',
        'Province/LGU': [participant.province, participant.lgu].filter(Boolean).join(' / ') || 'N/A',
        'Registration Date': formatDate(participant.registration?.regdate ?? null),
      }));
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      
      // Set column widths for better presentation
      ws['!cols'] = [
        { wch: 25 },  // Participant Name
        { wch: 45 },  // Designation
        { wch: 10 },  // Batch #
        { wch: 15 },  // Registration ID
        { wch: 40 },  // Province/LGU
        { wch: 30 },  // Registration Date
      ];
      
      // Add the worksheet to workbook
      const confName = selectedConference?.name || selectedConfcode;
      XLSX.utils.book_append_sheet(wb, ws, 'Approved Participants');
      
      // Generate filename
      const safeConfName = confName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeConfName}_approved_participants.xlsx`;
      
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
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                All Approved Participants
              </h1>
              <p className="text-gray-600 mt-1">View all approved participants by conference</p>
            </div>
          </div>
          
          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || participants.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors"
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
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
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
          <h2 className="text-xl font-bold text-indigo-900">
            {selectedConference.name || selectedConference.confcode}
          </h2>
          {selectedConference.name && (
            <p className="text-sm text-indigo-600 mt-1">{selectedConference.confcode}</p>
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
          <p className="text-gray-500">No approved participants found for this conference.</p>
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
                    Batch #
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {participants.map((participant, index) => (
                  <tr key={`${participant.regid}-${participant.linenum}-${index}`} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {[participant.lastname, participant.firstname, participant.middleinit]
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {participant.designation || 'N/A'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {participant.registration?.batchnum || 'N/A'}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{participants.length}</span> approved participant{participants.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
