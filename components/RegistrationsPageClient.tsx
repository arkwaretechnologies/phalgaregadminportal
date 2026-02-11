'use client';

import { useCallback, useEffect, useState } from 'react';
import RegistrationList from '@/components/RegistrationList';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Registration, Conference } from '@/types';

function RemainingSlotsCard({ refreshNonce, confcode }: { refreshNonce: number; confcode: string | null }) {
  const [data, setData] = useState<{
    limit: number | null;
    used: number;
    remaining: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSlots = useCallback(async () => {
    // Don't fetch without a confcode - wait until we have one
    if (!confcode) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('confcode', confcode);
      const res = await fetch(`/api/slots?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) {
        setData({
          limit: json.limit ?? null,
          used: typeof json.used === 'number' ? json.used : 0,
          remaining: json.remaining ?? null,
        });
      }
    } catch {
      // noop: show last known value
    } finally {
      setLoading(false);
    }
  }, [confcode]);

  // Trigger refresh on mount + when confcode changes
  // (nonce comes from actions like approve/reject).
  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  useEffect(() => {
    if (refreshNonce > 0) fetchSlots();
  }, [fetchSlots, refreshNonce]);

  const remaining = data?.remaining ?? null;
  const limit = data?.limit ?? null;
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 px-5 py-3 w-full sm:w-auto sm:min-w-[180px] text-left sm:text-right">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Remaining slots
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums flex items-center sm:justify-end gap-2">
        {loading ? (
          <span className="text-gray-400">
            <LoadingSpinner />
          </span>
        ) : (
          <span>{remaining === null ? '—' : remaining}</span>
        )}
      </div>
    </div>
  );
}

export default function RegistrationsPageClient({
  initialRegistrations,
  initialConfcode,
}: {
  initialRegistrations: Registration[];
  initialConfcode?: string | null;
}) {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [conferences, setConferences] = useState<Conference[]>([]);
  // Always start with initialConfcode from server - this is the source of truth
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(initialConfcode || null);
  const [loadingConferences, setLoadingConferences] = useState(true);
  
  // Fetch conferences on mount
  useEffect(() => {
    const fetchConferences = async () => {
      try {
        const res = await fetch('/api/conferences');
        const data = await res.json();
        if (res.ok) {
          const fetchedConferences = data.conferences || [];
          setConferences(fetchedConferences);
          
          // Only set default if we don't have a confcode yet
          if (typeof window !== 'undefined' && fetchedConferences.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const urlConfcode = params.get('confcode');
            const currentConfcode = urlConfcode || initialConfcode;
            
            if (!currentConfcode) {
              // No confcode set - default to first available
              const confcodeToUse = fetchedConferences[0].confcode;
              setSelectedConfcode(confcodeToUse);
              const url = new URL(window.location.href);
              url.searchParams.set('confcode', confcodeToUse);
              window.history.replaceState({}, '', url.toString());
            } else if (urlConfcode && urlConfcode !== initialConfcode) {
              // URL has different confcode than initial - sync state
              setSelectedConfcode(urlConfcode);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching conferences:', error);
      } finally {
        setLoadingConferences(false);
      }
    };
    fetchConferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegistrationsChanged = useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);

  const handleConferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return; // Prevent deselecting
    
    setSelectedConfcode(value);
    // Update URL with conference filter
    const url = new URL(window.location.href);
    url.searchParams.set('confcode', value);
    window.history.pushState({}, '', url.toString());
    // Trigger page reload to fetch filtered registrations
    window.location.reload();
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-start sm:justify-between gap-4 sm:gap-6 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Registrations
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">
                Manage participant registrations
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto sm:shrink-0">
            <RemainingSlotsCard refreshNonce={refreshNonce} confcode={selectedConfcode} />
          </div>
        </div>

        {/* Conference Filter */}
        <div className="mt-4">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <label htmlFor="conference-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Conference:
              </label>
              <select
                id="conference-filter"
                value={selectedConfcode || (conferences.length > 0 ? conferences[0].confcode : '')}
                onChange={handleConferenceChange}
                disabled={loadingConferences || conferences.length === 0}
                className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed bg-white text-gray-900"
              >
                {conferences.length === 0 && !loadingConferences ? (
                  <option value="">No conferences available</option>
                ) : (
                  conferences.map((conf) => (
                    <option key={conf.confcode} value={conf.confcode}>
                      {conf.confcode} {conf.name ? `- ${conf.name}` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      <RegistrationList
        initialRegistrations={initialRegistrations}
        onRegistrationsChanged={handleRegistrationsChanged}
        confcode={selectedConfcode}
      />
    </div>
  );
}

