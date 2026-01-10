'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ConfigMap = Record<string, string | null>;

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function ConfigurationClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [municipalityLimit, setMunicipalityLimit] = useState<string>('');
  const [registrationLimit, setRegistrationLimit] = useState<string>('');
  const [deadline, setDeadline] = useState<string>(''); // datetime-local

  const originalRef = useRef<{
    municipalityLimit: string;
    registrationLimit: string;
    deadline: string;
  } | null>(null);

  const payload = useMemo(
    () => ({
      PROVINCE_LGU_LIMIT: municipalityLimit,
      REGISTRATION_LIMIT: registrationLimit,
      REGISTRATION_DEADLINE: deadline ? new Date(deadline).toISOString() : '',
    }),
    [deadline, municipalityLimit, registrationLimit]
  );

  const load = async (opts?: { preserveSuccess?: boolean }) => {
    setLoading(true);
    setError(null);
    if (!opts?.preserveSuccess) setSuccess(null);
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to load configuration');
      }
      const data = (await res.json()) as { config: ConfigMap };
      const cfg = data?.config || {};

      const nextMunicipality = cfg.PROVINCE_LGU_LIMIT ?? '';
      const nextRegistration = cfg.REGISTRATION_LIMIT ?? '';
      const nextDeadline = toDateTimeLocal(cfg.REGISTRATION_DEADLINE ?? null);

      setMunicipalityLimit(nextMunicipality);
      setRegistrationLimit(nextRegistration);
      setDeadline(nextDeadline);

      originalRef.current = {
        municipalityLimit: nextMunicipality,
        registrationLimit: nextRegistration,
        deadline: nextDeadline,
      };
    } catch (e: any) {
      setError(e?.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save configuration');
      }
      setSuccess('Saved successfully.');
      setIsEditing(false);
      await load({ preserveSuccess: true });

      // Auto-hide success message after a short delay
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setError(null);
    setSuccess(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    const orig = originalRef.current;
    if (orig) {
      setMunicipalityLimit(orig.municipalityLimit);
      setRegistrationLimit(orig.registrationLimit);
      setDeadline(orig.deadline);
    }
    setError(null);
    setSuccess(null);
    setIsEditing(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
              Configuration
            </h1>
            <p className="text-gray-600 mt-1">Update registration limits and deadline</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 sm:p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-medium">{success}</p>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-gray-500">Loading configuration…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Municipality Participant Limit
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={municipalityLimit}
                  onChange={(e) => setMunicipalityLimit(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={!isEditing || saving}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Stored as <code className="font-mono">PROVINCE_LGU_LIMIT</code>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Participants Limit
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={registrationLimit}
                  onChange={(e) => setRegistrationLimit(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={!isEditing || saving}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Stored as <code className="font-mono">REGISTRATION_LIMIT</code>
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Deadline / Expiry
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={!isEditing || saving}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Stored as ISO string in <code className="font-mono">REGISTRATION_DEADLINE</code>
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={() => load()}
                disabled={saving || loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Reload
              </button>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={saving || loading}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

