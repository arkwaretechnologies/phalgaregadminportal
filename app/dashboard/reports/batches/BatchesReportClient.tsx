'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Conference } from '@/types';
import Pagination from '@/components/Pagination';

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

  // Filter batches based on search term (by regid or contactperson)
  const filteredBatches = batches.filter((batch) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    
    // Check if any registration in this batch matches the search term
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

  // Calculate total accepted participants across all batches
  const totalAcceptedParticipants = batches.reduce((sum, batch) => sum + batch.participant_count, 0);
  
  // Calculate filtered totals when search is active
  const filteredAcceptedParticipants = filteredBatches.reduce((sum, batch) => sum + batch.participant_count, 0);
  const isSearchActive = searchTerm.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
              Per Batch Number
            </h1>
            <p className="text-gray-600 mt-1">View approved registrations organized by batch number</p>
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
              Search by Reg ID or Contact Person
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
                placeholder="Enter Reg ID or Contact Person name..."
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
            <p className="text-sm text-gray-400">Try searching for a different Reg ID or Contact Person name.</p>
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
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform duration-300 ease-in-out ${
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
                                    {[participant.lastname, participant.firstname, participant.middleinit]
                                      .filter(Boolean)
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
    </div>
  );
}
