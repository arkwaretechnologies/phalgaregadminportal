'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegistrationDetail } from '@/types';
import ApprovalModal from '@/components/ApprovalModal';

interface RegistrationDetailClientProps {
  registration: RegistrationDetail;
}

export default function RegistrationDetailClient({
  registration,
}: RegistrationDetailClientProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-800">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">
            Pending
          </span>
        );
    }
  };

  const handleSuccess = () => {
    router.refresh();
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
          <p className="text-sm text-gray-600 mt-1">Transaction ID: {registration.transid}</p>
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
              <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
              <p className="text-base font-medium">{registration.transid}</p>
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

          {registration.status !== 'approved' && registration.status !== 'rejected' && (
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
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      T-Shirt Size
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
                        {item.contactnum || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.tshirtsize || 'N/A'}
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
    </>
  );
}


