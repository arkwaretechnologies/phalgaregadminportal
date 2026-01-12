'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Conference } from '@/types';

export default function DownloadParticipantsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [selectedConfcode, setSelectedConfcode] = useState<string | null>(null);
  const [loadingConferences, setLoadingConferences] = useState(true);
  const [downloadFormat, setDownloadFormat] = useState<'csv' | 'sql'>('csv');

  // Fetch conferences and default config on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoadingConferences(true);
      try {
        // Fetch conferences
        const confResponse = await fetch('/api/conferences');
        const confData = await confResponse.json();
        
        // Fetch default conference from config
        let defaultConfcode: string | null = null;
        try {
          const configResponse = await fetch('/api/config');
          const configData = await configResponse.json();
          if (configResponse.ok && configData.config?.DEFAULT_CONFERENCE) {
            defaultConfcode = configData.config.DEFAULT_CONFERENCE;
          }
        } catch {
          // Ignore config fetch errors
        }

        if (confResponse.ok) {
          const fetchedConferences = confData.conferences || [];
          setConferences(fetchedConferences);

          // Default to config default, or first conference if no default set
          if (fetchedConferences.length > 0 && !selectedConfcode) {
            // Check if default conf exists in the list
            const defaultExists = defaultConfcode && fetchedConferences.some((c: Conference) => c.confcode === defaultConfcode);
            setSelectedConfcode(defaultExists ? defaultConfcode : fetchedConferences[0].confcode);
          }
        }
      } catch (error) {
        console.error('Error fetching conferences:', error);
      } finally {
        setLoadingConferences(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadFile = async (url: string, filename: string): Promise<void> => {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        router.push('/login');
        throw new Error('Unauthorized');
      }
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to download ${filename}`);
    }

    // Get the file content
    const content = await response.text();
    
    // Create a blob and download it
    const blobType =
      filename.toLowerCase().endsWith('.sql')
        ? 'text/sql;charset=utf-8;'
        : 'text/csv;charset=utf-8;';
    const blob = new Blob([content], { type: blobType });
    const link = document.createElement('a');
    const downloadUrl = URL.createObjectURL(blob);
    
    link.setAttribute('href', downloadUrl);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(downloadUrl);
  };

  const handleDownload = async () => {
    if (!selectedConfcode) {
      setError('Please select a conference');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const confcodeParam = `?confcode=${encodeURIComponent(selectedConfcode)}&format=${encodeURIComponent(downloadFormat)}`;
      const ext = downloadFormat;

      // Download participants file first (regD)
      await downloadFile(
        `/api/participants/export${confcodeParam}`,
        `approved_participants_regD_${selectedConfcode}_${dateStr}.${ext}`
      );

      // Small delay to allow browser to handle first download
      await new Promise(resolve => setTimeout(resolve, 500));

      // Small delay to allow browser to handle first download
      await new Promise(resolve => setTimeout(resolve, 500));

      // Download registrations file (regH)
      await downloadFile(
        `/api/registrations/export${confcodeParam}`,
        `approved_participants_regH_${selectedConfcode}_${dateStr}.${ext}`
      );

      // Small delay to allow browser to handle second download
      await new Promise(resolve => setTimeout(resolve, 500));

      // Download dependents file (regdep)
      await downloadFile(
        `/api/dependents/export${confcodeParam}`,
        `approved_participants_regdep_${selectedConfcode}_${dateStr}.${ext}`
      );
    } catch (err: any) {
      console.error('Download error:', err);
      setError(err.message || 'Failed to download files');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
              Download Participant List
            </h1>
            <p className="text-gray-600 mt-1">Export all approved participants to CSV or SQL</p>
          </div>
        </div>
      </div>

      {/* Conference Filter */}
      <div className="mb-6 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="conference-filter" className="block text-sm font-medium text-gray-700 mb-2">
              Conference
            </label>
            <select
              id="conference-filter"
              value={selectedConfcode || ''}
              onChange={(e) => setSelectedConfcode(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
              disabled={loadingConferences || loading}
            >
              {loadingConferences ? (
                <option value="">Loading conferences...</option>
              ) : conferences.length === 0 ? (
                <option value="">No conferences available</option>
              ) : (
                conferences.map((conf) => (
                  <option key={conf.confcode} value={conf.confcode}>
                    {conf.confcode} - {conf.name || 'Unnamed Conference'}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="download-format" className="block text-sm font-medium text-gray-700 mb-2">
              Download format
            </label>
            <select
              id="download-format"
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value as 'csv' | 'sql')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
              disabled={loadingConferences || loading}
            >
              <option value="csv">CSV</option>
              <option value="sql">SQL (INSERT statements)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-full mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            Export Approved Data
          </h2>
          
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Select a conference above, then download three CSV/SQL files containing all approved registration data for that conference. 
            The first file includes participant details, the second file includes registration header information, and the third file includes dependent payment proofs. All three files will be downloaded automatically.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Error: {error}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={loading || !selectedConfcode || loadingConferences}
            className={`inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              loading ? 'animate-pulse' : ''
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Preparing Download...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download All Approved Data</span>
              </>
            )}
          </button>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="text-left max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Approved Participants CSV (approved_participants_regD_*.csv)
                </h3>
                <ul className="space-y-2 text-gray-600 ml-7">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Participant Names (Last, First, Middle Initial)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Transaction ID, Registration Number, and Date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Contact Information (Phone, Email)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Designation, Province, LGU, Barangay</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>T-Shirt Size and PRC Information</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Approved Registrations CSV (approved_participants_regH_*.csv)
                </h3>
                <ul className="space-y-2 text-gray-600 ml-7">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Registration Number and Transaction ID</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Confirmation Code and Registration Date</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Province, LGU, Contact Person</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Contact Number, Email, Status, Remarks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Payment Proof URL</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Approved Dependents CSV (approved_participants_regdep_*.csv)
                </h3>
                <ul className="space-y-2 text-gray-600 ml-7">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Registration ID (regid)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Conference Code (confcode)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Payment Proof URL (payment_proof_url)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

