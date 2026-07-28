'use client';

import { useState, useEffect } from 'react';
import { Registration } from '@/types';
import LoadingSpinner from './LoadingSpinner';

interface ApprovalModalProps {
  registration: Registration;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApprovalModal({
  registration,
  isOpen,
  onClose,
  onSuccess,
}: ApprovalModalProps) {
  const onValidation =
    String(registration.is_validating ?? '').trim().toUpperCase() === 'Y';
  const [action, setAction] = useState<'approve' | 'reject'>(
    onValidation ? 'approve' : 'reject'
  );
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setAction(onValidation ? 'approve' : 'reject');
    setRemarks('');
    setError('');
    setLoading(false);
  }, [isOpen, onValidation, registration.regid]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (action === 'approve' && !onValidation) {
      setError('Cannot approve registration if not on validation');
      return;
    }

    if (action === 'reject' && !remarks.trim()) {
      setError('Remarks are required when rejecting a registration');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          regid: registration.regid,
          batchnum: registration.batchnum || undefined, // Send if exists, otherwise undefined
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          remarks: remarks.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data.error || 'Failed to update registration';
        if (data.details) {
          errorMessage += `: ${data.details}`;
        }
        if (data.code) {
          errorMessage += ` (Code: ${data.code})`;
        }
        if (data.hint) {
          errorMessage += ` - ${data.hint}`;
        }
        console.error('Registration update error:', { data, status: response.status });
        setError(errorMessage);
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
      setRemarks('');
      setAction(onValidation ? 'approve' : 'reject');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-auto my-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900">
          {action === 'approve' ? 'Approve' : 'Reject'} Registration
        </h2>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Registration ID: {registration.regid}</p>
          <p className="text-sm text-gray-600">Contact: {registration.contactperson || 'N/A'}</p>
        </div>

        {!onValidation && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-sm text-amber-800">
              This registration must be On Validation before it can be approved. Reject is still available.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <div className="flex gap-4">
              <label
                className={`flex items-center ${
                  onValidation ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <input
                  type="radio"
                  value="approve"
                  checked={action === 'approve'}
                  onChange={(e) => {
                    setAction(e.target.value as 'approve');
                    setError('');
                  }}
                  className="mr-2"
                  disabled={loading || !onValidation}
                />
                Approve
              </label>
              <label className="flex items-center text-gray-900">
                <input
                  type="radio"
                  value="reject"
                  checked={action === 'reject'}
                  onChange={(e) => {
                    setAction(e.target.value as 'reject');
                    setError('');
                  }}
                  className="mr-2"
                  disabled={loading}
                />
                Reject
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="remarks"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Remarks {action === 'reject' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              id="remarks"
              rows={4}
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setError('');
              }}
              placeholder={action === 'reject' ? 'Enter rejection reason...' : 'Optional remarks...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
              required={action === 'reject'}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (action === 'approve' && !onValidation)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 ${
                action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? (
                <>
                  <LoadingSpinner />
                  <span>Processing…</span>
                </>
              ) : (
                <span>{action === 'approve' ? 'Approve' : 'Reject'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
