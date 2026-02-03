'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegistrationDetail, RegistrationDetailItem } from '@/types';
import ApprovalModal from '@/components/ApprovalModal';
import LoadingSpinner from '@/components/LoadingSpinner';

interface RegistrationDetailClientProps {
  registration: RegistrationDetail;
}

export default function RegistrationDetailClient({
  registration,
}: RegistrationDetailClientProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<RegistrationDetailItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
            APPROVED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
            UNSUCCESSFUL
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">
            PENDING
          </span>
        );
    }
  };

  const handleSuccess = () => {
    router.refresh();
  };

  const handleDeleteParticipant = async () => {
    if (!participantToDelete) return;

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const response = await fetch(
        `/api/registrations/${encodeURIComponent(registration.regid)}/participants/${participantToDelete.linenum}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.error || 'Failed to delete participant');
        setDeleteLoading(false);
        return;
      }

      // Close modal and refresh page
      setParticipantToDelete(null);
      setDeleteLoading(false);
      router.refresh();
    } catch (err) {
      setDeleteError('An error occurred. Please try again.');
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div>
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 text-sm text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Registrations
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Registration Details
          </h1>
          <p className="text-sm text-gray-600 mt-1">Registration ID: {registration.regid}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Registration Information
              </h2>
            </div>
            {getStatusBadge(registration.status)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Registration ID</p>
              <p className="text-base font-medium">{registration.regid}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Registration Date</p>
              <p className="text-base font-medium">{formatDate(registration.regdate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Province</p>
              <p className="text-base font-medium">{registration.province || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">LGU</p>
              <p className="text-base font-medium">{registration.lgu || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Contact Person</p>
              <p className="text-base font-medium">{registration.contactperson || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Contact Number</p>
              <p className="text-base font-medium">{registration.contactnum || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Email</p>
              <p className="text-base font-medium">{registration.email || 'N/A'}</p>
            </div>
            {registration.confcode && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Conference Code</p>
                <p className="text-base font-medium">{registration.confcode}</p>
              </div>
            )}
          </div>

          {registration.remarks && (
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <p className="text-sm font-medium text-gray-700 mb-1">Remarks</p>
              <p className="text-sm text-gray-600">{registration.remarks}</p>
            </div>
          )}

          {registration.status !== 'APPROVED' && registration.status !== 'REJECTED' && (
            <div className="mt-6">
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              >
                Approve/Reject Registration
              </button>
            </div>
          )}
        </div>

        {registration.regd && registration.regd.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Participants ({registration.regd.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Designation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Barangay
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      T-Shirt Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registration.regd.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.lastname}, {item.firstname} {item.middleinit || ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.designation || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.brgy || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.tshirtsize || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => setParticipantToDelete(item)}
                          className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                          title="Delete participant"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ApprovalModal
        registration={registration}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />

      {/* Delete Participant Confirmation Modal */}
      {participantToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-auto my-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Delete Participant
            </h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Are you sure you want to delete this participant?
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm font-medium text-gray-900">
                  {participantToDelete.lastname}, {participantToDelete.firstname} {participantToDelete.middleinit || ''}
                </p>
                <p className="text-sm text-gray-500">
                  {participantToDelete.designation || 'No designation'}
                </p>
              </div>
            </div>

            <p className="text-sm text-red-600 mb-4">
              This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setParticipantToDelete(null);
                  setDeleteError('');
                }}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteParticipant}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
              >
                {deleteLoading ? (
                  <>
                    <LoadingSpinner />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
