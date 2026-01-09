'use client';

import { useState, useEffect } from 'react';
import { RegistrationDetail } from '@/types';
import ApprovalModal from './ApprovalModal';
import CountdownTimer from './CountdownTimer';
import PaymentProofViewer from './PaymentProofViewer';

interface RegistrationDetailModalProps {
  registration: RegistrationDetail;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function RegistrationDetailModal({
  registration,
  isOpen,
  onClose,
  onUpdate,
}: RegistrationDetailModalProps) {
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [currentRegistration, setCurrentRegistration] = useState<RegistrationDetail>(registration);

  // Update local registration state when prop changes
  useEffect(() => {
    setCurrentRegistration(registration);
  }, [registration]);

  if (!isOpen) return null;

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
            REJECTED
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

  const handleApprovalSuccess = async () => {
    setShowApprovalModal(false);
    
    // Fetch updated registration details
    try {
      const response = await fetch(`/api/registrations/${registration.regnum}`);
      const data = await response.json();
      
      if (response.ok && data.registration) {
        setCurrentRegistration(data.registration);
      }
    } catch (error) {
      console.error('Error fetching updated registration:', error);
    }
    
    // Also update the parent list
    onUpdate();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Registration Details</h2>
              <p className="text-sm text-gray-600 mt-1">Transaction ID: {currentRegistration.transid}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Registration Information */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Registration Information</h3>
                  {currentRegistration.status === 'PENDING' && currentRegistration.regdate && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-gray-600">Time Left:</span>
                      <CountdownTimer
                        registrationDate={currentRegistration.regdate}
                        status={currentRegistration.status}
                        onExpired={() => {
                          // Refresh the modal data when expired
                          setTimeout(async () => {
                            try {
                              const response = await fetch(`/api/registrations/${currentRegistration.regnum}`);
                              const data = await response.json();
                              if (response.ok && data.registration) {
                                setCurrentRegistration(data.registration);
                              }
                            } catch (error) {
                              console.error('Error fetching updated registration:', error);
                            }
                            onUpdate();
                          }, 1000);
                        }}
                      />
                    </div>
                  )}
                </div>
                {getStatusBadge(currentRegistration.status)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                  <p className="text-base font-medium text-gray-900">{currentRegistration.transid}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Registration Date</p>
                  <p className="text-base font-medium text-gray-900">{formatDate(currentRegistration.regdate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Province</p>
                  <p className="text-base font-medium text-gray-900">{currentRegistration.province || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">LGU</p>
                  <p className="text-base font-medium text-gray-900">{currentRegistration.lgu || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Contact Person</p>
                  <p className="text-base font-medium text-gray-900">{currentRegistration.contactperson || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Contact Number</p>
                  <p className="text-base font-medium text-gray-900">{currentRegistration.contactnum || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <p className="text-base font-medium text-gray-900">{currentRegistration.email || 'N/A'}</p>
                </div>
                {currentRegistration.confcode && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Conference Code</p>
                    <p className="text-base font-medium text-gray-900">{currentRegistration.confcode}</p>
                  </div>
                )}
              </div>

              {/* Payment Proof Section */}
              <PaymentProofViewer 
                regnum={currentRegistration.regnum} 
                transid={currentRegistration.transid}
              />

              {currentRegistration.remarks && (
                <div className="mt-6 p-4 bg-white rounded-md border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">Remarks</p>
                  <p className="text-sm text-gray-600">{currentRegistration.remarks}</p>
                </div>
              )}

              {currentRegistration.status !== 'APPROVED' && currentRegistration.status !== 'REJECTED' && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                  >
                    Approve/Reject Registration
                  </button>
                </div>
              )}
            </div>

            {/* Participants */}
            {currentRegistration.regd && currentRegistration.regd.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Participants ({currentRegistration.regd.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg">
                    <thead className="bg-gray-100">
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
                      {currentRegistration.regd.map((item, index) => (
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

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {showApprovalModal && (
        <ApprovalModal
          registration={currentRegistration}
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          onSuccess={handleApprovalSuccess}
        />
      )}
    </>
  );
}
