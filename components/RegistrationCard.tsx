'use client';

import { Registration } from '@/types';
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

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
            APPROVED
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
          {getStatusBadge(registration.status)}
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
          {registration.status !== 'APPROVED' && registration.status !== 'REJECTED' && (
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


