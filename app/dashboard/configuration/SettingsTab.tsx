'use client';

import { useState, useEffect } from 'react';
import { Conference } from '@/types';

export default function SettingsTab() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [defaultConference, setDefaultConference] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      
      try {
        // Fetch conferences
        const confRes = await fetch('/api/conferences');
        const confData = await confRes.json();
        if (confRes.ok) {
          setConferences(confData.conferences || []);
        }

        // Fetch current config
        const configRes = await fetch('/api/config');
        const configData = await configRes.json();
        if (configRes.ok && configData.config) {
          setDefaultConference(configData.config.DEFAULT_CONFERENCE || '');
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          DEFAULT_CONFERENCE: defaultConference || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Settings</h2>
        <p className="text-sm text-gray-500">Configure default options for the application</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Default Conference</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select the conference that will be pre-selected when opening the Registrations page and reports.
        </p>
        
        <div className="max-w-md">
          <label htmlFor="default-conference" className="block text-sm font-medium text-gray-700 mb-2">
            Conference
          </label>
          <select
            id="default-conference"
            value={defaultConference}
            onChange={(e) => setDefaultConference(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
          >
            <option value="">-- Use first conference --</option>
            {conferences.map((conference) => (
              <option key={conference.confcode} value={conference.confcode}>
                {conference.confcode} - {conference.name || 'Unnamed Conference'}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            If no default is set, the first conference in the list will be used.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg shadow-md transition-colors"
        >
          {saving ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
