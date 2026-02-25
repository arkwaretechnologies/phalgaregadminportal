'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RegistrationDetail, RegistrationDetailItem } from '@/types';
import ApprovalModal from './ApprovalModal';
import CountdownTimer from './CountdownTimer';
import PaymentProofViewer from './PaymentProofViewer';
import LoadingSpinner from './LoadingSpinner';

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '5XL', '8XL'] as const;

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
  const [participantToDelete, setParticipantToDelete] = useState<RegistrationDetailItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // T-shirt size edit state
  const [participantToEditTshirt, setParticipantToEditTshirt] = useState<RegistrationDetailItem | null>(null);
  const [tshirtEditValue, setTshirtEditValue] = useState('');
  const [tshirtSaving, setTshirtSaving] = useState(false);
  const [tshirtError, setTshirtError] = useState('');

  // Contact edit state
  const [showContactEditModal, setShowContactEditModal] = useState(false);
  const [contactEmail, setContactEmail] = useState(registration.email || '');
  const [contactPhone, setContactPhone] = useState(registration.contactnum || '');
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState('');


  // Update local registration state when prop changes
  useEffect(() => {
    setCurrentRegistration(registration);
    setContactEmail(registration.email || '');
    setContactPhone(registration.contactnum || '');
  }, [registration]);

  const openContactEditModal = () => {
    setContactEmail(currentRegistration.email || '');
    setContactPhone(currentRegistration.contactnum || '');
    setContactError('');
    setContactSuccess('');
    setShowContactEditModal(true);
  };

  const closeContactEditModal = () => {
    setShowContactEditModal(false);
    setContactError('');
    setContactSuccess('');
  };

  const handleSaveContactDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSaving(true);
    setContactError('');
    setContactSuccess('');

    try {
      const response = await fetch(
        `/api/registrations/${encodeURIComponent(currentRegistration.regid)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: contactEmail.trim() || null,
            contactnum: contactPhone.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setContactError(data.error || 'Failed to update contact details');
        setContactSaving(false);
        return;
      }

      // Update local state with new values
      setCurrentRegistration(prev => ({
        ...prev,
        email: contactEmail.trim() || null,
        contactnum: contactPhone.trim().replace(/\D/g, '') || null,
      }));

      setContactSuccess('Contact details updated successfully');
      setContactSaving(false);
      
      // Close modal after brief delay to show success and update parent
      setTimeout(() => {
        closeContactEditModal();
        onUpdate();
      }, 1000);
    } catch (err) {
      setContactError('An error occurred. Please try again.');
      setContactSaving(false);
    }
  };


  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadge = (status: string | null, batchnum?: number | null) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            CONFIRMED{batchnum ? ` Batch ${batchnum}` : ''}
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

  const handleApprovalSuccess = async () => {
    setShowApprovalModal(false);
    
    // Fetch updated registration details
    try {
      // Always use regid - batchnum is no longer globally unique (per-conference)
      const url = `/api/registrations/${encodeURIComponent(registration.regid)}`;
      const response = await fetch(url);
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

  const handleDeleteParticipant = async () => {
    if (!participantToDelete) return;

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const response = await fetch(
        `/api/registrations/${encodeURIComponent(currentRegistration.regid)}/participants/${participantToDelete.linenum}`,
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

      // Update local registration state to remove the deleted participant
      setCurrentRegistration(prev => ({
        ...prev,
        regd: prev.regd?.filter(p => p.linenum !== participantToDelete.linenum),
      }));

      // Close delete modal
      setParticipantToDelete(null);
      setDeleteLoading(false);
      
      // Update parent list
      onUpdate();
    } catch (err) {
      setDeleteError('An error occurred. Please try again.');
      setDeleteLoading(false);
    }
  };

  const openTshirtEdit = (item: RegistrationDetailItem) => {
    setParticipantToEditTshirt(item);
    setTshirtEditValue(item.tshirtsize ?? '');
    setTshirtError('');
  };

  const handleSaveTshirt = async () => {
    if (!participantToEditTshirt) return;

    setTshirtSaving(true);
    setTshirtError('');

    try {
      const response = await fetch(
        `/api/registrations/${encodeURIComponent(currentRegistration.regid)}/participants/${participantToEditTshirt.linenum}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tshirtsize: tshirtEditValue.trim() || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setTshirtError(data.error || 'Failed to update t-shirt size');
        setTshirtSaving(false);
        return;
      }

      setCurrentRegistration(prev => ({
        ...prev,
        regd: prev.regd?.map(p =>
          p.linenum === participantToEditTshirt.linenum
            ? { ...p, tshirtsize: tshirtEditValue.trim() || null }
            : p
        ),
      }));

      setParticipantToEditTshirt(null);
      setTshirtSaving(false);
      onUpdate();
    } catch (err) {
      setTshirtError('An error occurred. Please try again.');
      setTshirtSaving(false);
    }
  };

  // Fixed registration fee per participant (to be made dynamic per conference later)
  const REGISTRATION_FEE = 7500;
  const participantCount = currentRegistration.regd?.length ?? 0;
  const expectedTotalPayment = participantCount * REGISTRATION_FEE;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-start justify-between gap-4 z-20">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Registration Details</h2>
              <p className="text-sm text-gray-600 mt-1 break-words">
                Registration ID: {currentRegistration.regid}
              </p>
              {participantCount > 0 && (
                <p className="text-sm font-medium text-gray-900 mt-2">
                  Expected total payment: ₱{expectedTotalPayment.toLocaleString('en-PH')}
                  <span className="text-gray-500 font-normal"> ({participantCount} × ₱{REGISTRATION_FEE.toLocaleString('en-PH')})</span>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {/* Registration Information */}
            <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900">Registration Information</h3>
                  {currentRegistration.status === 'PENDING' && currentRegistration.regdate && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600 whitespace-nowrap">Time Left:</span>
                      <CountdownTimer
                        registrationDate={currentRegistration.regdate}
                        status={currentRegistration.status}
                      />
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(currentRegistration.status, currentRegistration.batchnum)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
                  <p className="text-base font-medium text-gray-900">{currentRegistration.regid}</p>
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
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-500">Contact Number</p>
                    <button
                      onClick={openContactEditModal}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      title="Edit contact details"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                  <p className="text-base font-medium text-gray-900">{currentRegistration.contactnum || 'N/A'}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-500">Email</p>
                    <button
                      onClick={openContactEditModal}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      title="Edit contact details"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>
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
                batchnum={currentRegistration.batchnum} 
                regid={currentRegistration.regid}
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
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                  >
                    Approve/Reject Registration
                  </button>
                </div>
              )}
            </div>

            {/* Participants */}
            {currentRegistration.regd && currentRegistration.regd.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
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
                          Barangay
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          T-Shirt Size
                        </th>
                        {currentRegistration.status !== 'APPROVED' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
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
                            {item.brgy || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="inline-flex items-center gap-1.5">
                              {item.tshirtsize || 'N/A'}
                              <button
                                onClick={() => openTshirtEdit(item)}
                                className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50"
                                title="Edit T-shirt size"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </span>
                          </td>
                          {currentRegistration.status !== 'APPROVED' && (
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
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-4 flex justify-end z-20">
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

      {/* Delete Participant Confirmation Modal */}
      {participantToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-[60] p-4 overflow-y-auto">
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

      {/* Edit T-shirt Size Modal */}
      {participantToEditTshirt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-auto my-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Edit T-Shirt Size
            </h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Participant</p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm font-medium text-gray-900">
                  {participantToEditTshirt.lastname}, {participantToEditTshirt.firstname} {participantToEditTshirt.middleinit || ''}
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="tshirt-size-edit" className="block text-sm font-medium text-gray-700 mb-1">
                T-Shirt Size
              </label>
              <select
                id="tshirt-size-edit"
                value={tshirtEditValue}
                onChange={(e) => setTshirtEditValue(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">Not specified</option>
                {TSHIRT_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            {tshirtError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{tshirtError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setParticipantToEditTshirt(null);
                  setTshirtError('');
                }}
                disabled={tshirtSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTshirt}
                disabled={tshirtSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
              >
                {tshirtSaving ? (
                  <>
                    <LoadingSpinner />
                    <span>Saving…</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Details Modal */}
      {showContactEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto my-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Contact Details
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Update email and phone number for the contact person
              </p>
            </div>
            <form onSubmit={handleSaveContactDetails} className="p-6 space-y-4">
              {contactError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{contactError}</p>
                </div>
              )}
              {contactSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">{contactSuccess}</p>
                </div>
              )}
              <div>
                <label htmlFor="modal_contact_email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="modal_contact_email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., contact@example.com"
                  disabled={contactSaving}
                />
              </div>
              <div>
                <label htmlFor="modal_contact_phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  id="modal_contact_phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., 09123456789"
                  maxLength={11}
                  disabled={contactSaving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be exactly 11 digits (e.g., 09123456789)
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeContactEditModal}
                  disabled={contactSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contactSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {contactSaving ? (
                    <>
                      <LoadingSpinner />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
