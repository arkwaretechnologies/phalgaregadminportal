'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Conference } from '@/types';
import * as XLSX from 'xlsx';

interface DuplicateGroup {
  confcode: string | null;
  lastname: string | null;
  firstname: string | null;
  count: number;
  participants: Array<{
    regid: string;
    linenum: number;
    lastname: string | null;
    firstname: string | null;
    middleinit?: string | null;
    email?: string | null;
    contactnum?: string | null;
    registration?: {
      regid: string;
      batchnum: number | null;
      confcode: string | null;
      regdate: string | null;
      status: string | null;
    } | null;
  }>;
}

interface DuplicatesReportClientProps {
  initialConferences: Conference[];
  initialConfcode: string | null;
  initialStatus?: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export default function DuplicatesReportClient({
  initialConferences,
  initialConfcode,
  initialStatus = 'ALL',
}: DuplicatesReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') || initialStatus);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const selectedConference = conferences.find((c) => c.confcode === selectedConfcode);

  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus && ['APPROVED', 'PENDING', 'ALL'].includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedConfcode) {
        setGroups([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const url = new URL('/api/reports/duplicates', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);
        url.searchParams.set('status', statusFilter);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (response.ok) {
          setGroups(data.groups || []);
        } else {
          setError(data.error || 'Failed to fetch duplicate groups');
          setGroups([]);
        }
      } catch (err) {
        console.error('Error fetching duplicates report:', err);
        setError('An error occurred while fetching data');
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedConfcode, statusFilter]);

  const handleConferenceChange = (confcode: string) => {
    setSelectedConfcode(confcode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('confcode', confcode);
    router.push(`/dashboard/reports/duplicates?${params.toString()}`);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', status);
    router.push(`/dashboard/reports/duplicates?${params.toString()}`);
  };

  const groupKey = (g: DuplicateGroup) =>
    `${g.confcode ?? ''}\t${g.lastname ?? ''}\t${g.firstname ?? ''}`;

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExportExcel = () => {
    if (!selectedConfcode || groups.length === 0) return;

    setExporting(true);
    try {
      const confName = selectedConference?.name || selectedConfcode;
      const safeConfName = confName.replace(/[^a-zA-Z0-9]/g, '_');
      const statusLabel =
        statusFilter === 'APPROVED'
          ? 'Approved'
          : statusFilter === 'PENDING'
            ? 'Pending'
            : 'All';

      const rows: (string | number)[][] = [];
      for (const g of groups) {
        const nameDisplay = [g.lastname, g.firstname].filter(Boolean).join(', ') || 'N/A';
        for (const p of g.participants) {
          const reg = p.registration;
          rows.push([
            g.confcode ?? '',
            nameDisplay,
            g.count,
            p.regid ?? '',
            formatDate(reg?.regdate ?? null),
            reg?.status ?? '',
            reg?.batchnum ?? '',
          ]);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet([
        ['Conference', 'Name (Last, First)', 'Duplicate Count', 'Registration ID', 'Reg Date', 'Status', 'Batch #'],
        ...rows,
      ]);
      ws['!cols'] = [
        { wch: 14 },
        { wch: 28 },
        { wch: 10 },
        { wch: 18 },
        { wch: 22 },
        { wch: 10 },
        { wch: 10 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Possible Duplicates');
      XLSX.writeFile(wb, `${safeConfName}_possible_duplicates_${statusLabel}.xlsx`);
    } catch (err: unknown) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                Possible Duplicate Entry
              </h1>
              <p className="text-gray-600 mt-1">
                Review possible duplicate registrations (same name) and open each registration to compare
              </p>
            </div>
          </div>
          <button
            onClick={handleExportExcel}
            disabled={exporting || loading || groups.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors"
          >
            {exporting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 bg-white text-gray-900 text-sm sm:text-base"
            >
              <option value="ALL">All (Pending + Approved)</option>
              <option value="PENDING">Pending only</option>
              <option value="APPROVED">Approved only</option>
            </select>
          </div>
        </div>
      </div>

      {selectedConference && (
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
          <h2 className="text-xl font-bold text-amber-900">
            {selectedConference.name || selectedConference.confcode}
          </h2>
          {selectedConference.name && (
            <p className="text-sm text-amber-600 mt-1">{selectedConference.confcode}</p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg
            className="w-10 h-10 animate-spin text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Duplicate name groups</p>
                <p className="text-3xl font-bold text-gray-900">{groups.length}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Same last name + first name in this conference
                  {statusFilter !== 'ALL' && ` (${statusFilter} only)`}
                </p>
              </div>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center text-gray-500">
              No duplicate name groups found for the selected conference and status.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-10" />
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        First name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groups.map((g) => {
                      const key = groupKey(g);
                      const isExpanded = expandedKeys.has(key);
                      const nameLast = g.lastname ?? '—';
                      const nameFirst = g.firstname ?? '—';
                      return (
                        <React.Fragment key={key}>
                          <tr
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleExpanded(key)}
                          >
                            <td className="px-4 py-2">
                              <span className="text-gray-500">
                                {isExpanded ? (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{nameLast}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{nameFirst}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{g.count}</td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={4} className="px-4 py-0 bg-gray-50">
                                <div className="py-3 pl-6 space-y-2">
                                  {g.participants.map((p, idx) => {
                                    const reg = p.registration;
                                    const regid = reg?.regid ?? p.regid;
                                    return (
                                      <div
                                        key={`${p.regid}-${p.linenum}-${idx}`}
                                        className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                                      >
                                        <span className="font-medium text-gray-700">
                                          Reg ID: {regid}
                                        </span>
                                        <span className="text-gray-500">
                                          {formatDate(reg?.regdate ?? null)} · {reg?.status ?? '—'}
                                          {reg?.batchnum != null ? ` · Batch ${reg.batchnum}` : ''}
                                        </span>
                                        <Link
                                          href={`/dashboard/registrations/${encodeURIComponent(regid)}`}
                                          className="text-amber-600 hover:text-amber-700 font-medium"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          View registration →
                                        </Link>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
