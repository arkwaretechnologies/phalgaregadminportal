'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Conference } from '@/types';

type MissingPrcRow = {
  regid: string | null;
  linenum: number | null;
  lastname: string | null;
  firstname: string | null;
  middleinit: string | null;
  suffix: string | null;
  designation: string | null;
  province: string | null;
  lgu: string | null;
  contactnum: string | null;
  email: string | null;
  prcnum: string | null;
  expirydate: string | null;
};

export default function MissingPrcClient({
  initialConferences,
  initialConfcode,
}: {
  initialConferences: Conference[];
  initialConfcode: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conferences] = useState<Conference[]>(initialConferences);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode);

  const [rows, setRows] = useState<MissingPrcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const selectedConference = conferences.find((c) => c.confcode === selectedConfcode) || null;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const name = [r.lastname, r.firstname, r.middleinit, r.suffix].filter(Boolean).join(' ').toLowerCase();
      return (
        name.includes(query) ||
        String(r.regid ?? '').toLowerCase().includes(query) ||
        String(r.province ?? '').toLowerCase().includes(query) ||
        String(r.lgu ?? '').toLowerCase().includes(query) ||
        String(r.designation ?? '').toLowerCase().includes(query)
      );
    });
  }, [rows, q]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedConfcode) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const url = new URL('/api/reports/missing-prc', window.location.origin);
        url.searchParams.set('confcode', selectedConfcode);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          setRows([]);
          setError(json.error || 'Failed to fetch report');
        } else {
          setRows(json.participants || []);
        }
      } catch (e) {
        setRows([]);
        setError('An error occurred while fetching report');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedConfcode]);

  const handleConferenceChange = (confcode: string) => {
    setSelectedConfcode(confcode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('confcode', confcode);
    router.push(`/dashboard/reports/missing-prc?${params.toString()}`);
  };

  const formatDateOnly = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Missing PRC No Participants</h1>
        <p className="text-sm text-gray-600 mt-1">
          ANC conferences only. Shows participants in <code className="px-1 py-0.5 bg-gray-100 rounded">regd</code> where{' '}
          <code className="px-1 py-0.5 bg-gray-100 rounded">prcnum</code> is blank or null.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conference</label>
            <select
              value={selectedConfcode || ''}
              onChange={(e) => handleConferenceChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {conferences.map((c) => (
                <option key={c.confcode} value={c.confcode}>
                  {c.confcode} - {c.name || 'Unnamed Conference'}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, regid, province, lgu, designation…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {selectedConference && String(selectedConference.is_anc ?? '').toUpperCase() !== 'Y' && (
          <div className="mt-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            This selected conference is not ANC (<code className="px-1 bg-amber-100 rounded">is_anc != Y</code>). The API will
            return an error for this report.
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-700">
            {loading ? 'Loading…' : `Found ${filtered.length} participant${filtered.length === 1 ? '' : 's'}`}
          </div>
        </div>

        {error && (
          <div className="px-4 sm:px-6 py-4 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reg ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Designation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Province</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LGU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRC No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!loading &&
                filtered.map((r, idx) => (
                  <tr key={`${r.regid ?? 'na'}-${r.linenum ?? idx}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{r.regid || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {(r.lastname || 'N/A')}, {r.firstname || ''} {r.middleinit || ''} {r.suffix || ''}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{r.designation || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{r.province || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{r.lgu || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{r.contactnum || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{r.email || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{r.prcnum || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDateOnly(r.expirydate)}</td>
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500" colSpan={9}>
                    No missing PRC numbers found for the current selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

