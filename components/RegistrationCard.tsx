'use client';

import { Registration } from '@/types';
import {
  ACCEPTED_AWARD_STATUS,
  APPROVED_PARTICIPANT_AND_ACCOMPANYING_LEGACY,
  APPROVED_REPRESENTATIVE_AND_ACCOMPANYING,
  isApprovedStatus,
} from '@/lib/registration-status';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ApprovalModal from './ApprovalModal';

interface RegistrationCardProps {
  registration: Registration;
  onUpdate: () => void;
}

export default function RegistrationCard({
  registration,
  onUpdate,
}: RegistrationCardProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const getStatusBadge = (status: string | null, batchnum?: number | null) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
            <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            CONFIRMED{batchnum ? ` Batch ${batchnum}` : ''}
          </span>
        );
      case ACCEPTED_AWARD_STATUS:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 max-w-md">
            <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-left leading-snug">{ACCEPTED_AWARD_STATUS}</span>
          </span>
        );
      case APPROVED_REPRESENTATIVE_AND_ACCOMPANYING:
      case APPROVED_PARTICIPANT_AND_ACCOMPANYING_LEGACY:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 max-w-md">
            <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-left leading-snug">
              {APPROVED_REPRESENTATIVE_AND_ACCOMPANYING}
            </span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
            UNSUCCESSFUL
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
            PENDING
          </span>
        );
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {registration.regid}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Registered: {formatDate(registration.regdate)}
            </p>
          </div>
          {getStatusBadge(registration.status, registration.batchnum)}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Province</p>
            <p className="text-sm font-medium">{registration.province || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">LGU</p>
            <p className="text-sm font-medium">{registration.lgu || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Contact Person</p>
            <p className="text-sm font-medium">{registration.contactperson || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="text-sm font-medium">{registration.email || 'N/A'}</p>
          </div>
        </div>

        {registration.remarks && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-500 mb-1">Remarks</p>
            <p className="text-sm text-gray-700">{registration.remarks}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              // Always use regid - batchnum is no longer globally unique (per-conference)
              router.push(`/dashboard/registrations/${encodeURIComponent(registration.regid)}`);
            }}
            className="flex-1 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
          >
            View Details
          </button>
          {!isApprovedStatus(registration.status) && registration.status !== 'REJECTED' && (
            <button
              onClick={() => setShowModal(true)}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              Approve/Reject
            </button>
          )}
        </div>
      </div>

      <ApprovalModal
        registration={registration}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={onUpdate}
      />
    </>
  );
}


