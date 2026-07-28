'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegistrationDetail, RegistrationDetailItem, Position } from '@/types';
import ApprovalModal from '@/components/ApprovalModal';
import LoadingSpinner from '@/components/LoadingSpinner';
import { conferenceIsAnc } from '@/lib/conference-is-anc';
import { formatFoodPreference } from '@/lib/food-preference';
import {
  ACCEPTED_AWARD_STATUS,
  APPROVED_PARTICIPANT_AND_ACCOMPANYING_LEGACY,
  APPROVED_REPRESENTATIVE_AND_ACCOMPANYING,
  APPROVED_REPRESENTATIVE_ONLY,
  conferenceIsAward,
  countAwardAccompanyingOnly,
  isApprovedStatus,
  isAwardRepresentativePhaseDbStatus,
  registrationDetailParticipantsSectionTitle,
} from '@/lib/registration-status';

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '5XL', '8XL'] as const;

function isValidatingFlag(value: string | null | undefined): boolean {
  return String(value ?? '').trim().toUpperCase() === 'Y';
}

interface RegistrationDetailClientProps {
  registration: RegistrationDetail;
}

function resolvedRegistrationFee(reg_fee: RegistrationDetail['reg_fee']): number {
  if (reg_fee === null || reg_fee === undefined) return 7500;
  const n = typeof reg_fee === 'number' ? reg_fee : parseFloat(String(reg_fee).replace(/[₱,\s]/g, ''));
  return Number.isFinite(n) ? n : 7500;
}

export default function RegistrationDetailClient({
  registration,
}: RegistrationDetailClientProps) {
  const registrationFeePerParticipant = resolvedRegistrationFee(registration.reg_fee);
  const awardAccompanyingCount = countAwardAccompanyingOnly(registration.regd);
  const billableParticipantCount = conferenceIsAward(registration.is_award)
    ? awardAccompanyingCount
    : registration.regd?.length ?? 0;
  const participantSectionCount = conferenceIsAward(registration.is_award)
    ? awardAccompanyingCount
    : registration.regd?.length ?? 0;
  const isAnc = conferenceIsAnc(registration.is_anc);
  const participantThPad = isAnc ? 'px-3 py-2.5' : 'px-6 py-3';
  const participantTdPad = isAnc ? 'px-3 py-3' : 'px-6 py-4';
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<RegistrationDetailItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // T-shirt size edit state
  const [participantToEditTshirt, setParticipantToEditTshirt] = useState<RegistrationDetailItem | null>(null);
  const [tshirtEditValue, setTshirtEditValue] = useState('');
  const [tshirtSaving, setTshirtSaving] = useState(false);
  const [tshirtError, setTshirtError] = useState('');

  // Name / designation edit state
  const [participantToEditName, setParticipantToEditName] = useState<RegistrationDetailItem | null>(null);
  const [nameEditLastname, setNameEditLastname] = useState('');
  const [nameEditFirstname, setNameEditFirstname] = useState('');
  const [nameEditMiddleinit, setNameEditMiddleinit] = useState('');
  const [nameEditSuffix, setNameEditSuffix] = useState('');
  const [nameEditDesignation, setNameEditDesignation] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);

  // Registration contact edit state (email, contact number)
  const [showContactEdit, setShowContactEdit] = useState(false);
  const [contactEditEmail, setContactEditEmail] = useState('');
  const [contactEditNum, setContactEditNum] = useState('');
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState('');
  const [validationSaving, setValidationSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getStatusBadge = (status: string | null) => {
    if (conferenceIsAward(registration.is_award) && isAwardRepresentativePhaseDbStatus(status)) {
      return (
        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-amber-100 text-amber-900 max-w-lg leading-snug inline-block">
          {APPROVED_REPRESENTATIVE_ONLY}
        </span>
      );
    }
    switch (status) {
      case ACCEPTED_AWARD_STATUS:
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 max-w-lg leading-snug inline-block">
            {ACCEPTED_AWARD_STATUS}
          </span>
        );
      case APPROVED_REPRESENTATIVE_AND_ACCOMPANYING:
      case APPROVED_PARTICIPANT_AND_ACCOMPANYING_LEGACY:
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 max-w-lg leading-snug inline-block">
            {APPROVED_REPRESENTATIVE_AND_ACCOMPANYING}
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
            Approved
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
            Pending
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
        `/api/registrations/${encodeURIComponent(registration.regid)}/participants/${participantToEditTshirt.linenum}`,
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

      setParticipantToEditTshirt(null);
      setTshirtSaving(false);
      router.refresh();
    } catch (err) {
      setTshirtError('An error occurred. Please try again.');
      setTshirtSaving(false);
    }
  };

  const openNameEdit = async (item: RegistrationDetailItem) => {
    setParticipantToEditName(item);
    setNameEditLastname((item.lastname ?? '').toUpperCase());
    setNameEditFirstname((item.firstname ?? '').toUpperCase());
    setNameEditMiddleinit((item.middleinit ?? '').toUpperCase());
    setNameEditSuffix((item.suffix ?? '').toUpperCase());
    setNameEditDesignation((item.designation ?? '').toUpperCase());
    setNameError('');

    if (positions.length === 0) {
      setPositionsLoading(true);
      try {
        const response = await fetch('/api/positions');
        const data = await response.json();
        if (response.ok) {
          setPositions(data.positions || []);
        } else {
          setNameError(data.error || 'Failed to load designations');
        }
      } catch {
        setNameError('Failed to load designations');
      } finally {
        setPositionsLoading(false);
      }
    }
  };

  const closeNameEdit = () => {
    setParticipantToEditName(null);
    setNameError('');
  };

  const handleSaveName = async () => {
    if (!participantToEditName) return;

    const lastname = nameEditLastname.trim().toUpperCase();
    const firstname = nameEditFirstname.trim().toUpperCase();
    const designation = nameEditDesignation.trim().toUpperCase();

    if (!lastname) {
      setNameError('Last name is required');
      return;
    }
    if (!firstname) {
      setNameError('First name is required');
      return;
    }
    if (!designation) {
      setNameError('Designation is required');
      return;
    }

    setNameSaving(true);
    setNameError('');

    try {
      const response = await fetch(
        `/api/registrations/${encodeURIComponent(registration.regid)}/participants/${participantToEditName.linenum}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lastname,
            firstname,
            middleinit: nameEditMiddleinit.trim().toUpperCase() || null,
            suffix: nameEditSuffix.trim().toUpperCase() || null,
            designation,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setNameError(data.error || 'Failed to update name and designation');
        setNameSaving(false);
        return;
      }

      closeNameEdit();
      setNameSaving(false);
      router.refresh();
    } catch (err) {
      setNameError('An error occurred. Please try again.');
      setNameSaving(false);
    }
  };

  const openContactEdit = () => {
    setContactEditEmail(registration.email ?? '');
    setContactEditNum(registration.contactnum ?? '');
    setContactError('');
    setShowContactEdit(true);
  };

  const handleSaveContact = async () => {
    setContactSaving(true);
    setContactError('');

    try {
      const response = await fetch(
        `/api/registrations/${encodeURIComponent(registration.regid)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: contactEditEmail.trim() || null,
            contactnum: contactEditNum.trim().replace(/\D/g, '') || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setContactError(data.error || 'Failed to update contact details');
        setContactSaving(false);
        return;
      }

      setShowContactEdit(false);
      setContactSaving(false);
      router.refresh();
    } catch (err) {
      setContactError('An error occurred. Please try again.');
      setContactSaving(false);
    }
  };

  const canToggleValidation = () =>
    !isApprovedStatus(registration.status) && registration.status !== 'REJECTED';

  const handleToggleValidation = async (checked: boolean) => {
    if (!registration.regid || !canToggleValidation()) return;

    setValidationSaving(true);
    setValidationError('');

    try {
      const response = await fetch(
        `/api/registrations/${encodeURIComponent(registration.regid)}/validation`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on_validation: checked }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update validation');
      }

      router.refresh();
    } catch (error: any) {
      setValidationError(error?.message || 'Failed to update validation. Please try again.');
    } finally {
      setValidationSaving(false);
    }
  };

  return (
    <>
      <div className={isAnc ? 'w-full min-w-0 max-w-7xl 2xl:max-w-[min(90rem,100%)] mx-auto' : 'w-full min-w-0'}>
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
          {registration.regd && registration.regd.length > 0 && (
            <p className="text-sm font-medium text-gray-900 mt-2">
              Expected total payment: ₱
              {(billableParticipantCount * registrationFeePerParticipant).toLocaleString('en-PH')}
              <span className="text-gray-500 font-normal">
                {' '}
                ({billableParticipantCount} × ₱{registrationFeePerParticipant.toLocaleString('en-PH')}
                {conferenceIsAward(registration.is_award) &&
                registration.regd.length > billableParticipantCount
                  ? '; representative excluded'
                  : ''}
                )
              </span>
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Registration Information
              </h2>
              <button
                type="button"
                onClick={openContactEdit}
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit contact
              </button>
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
            {!isAnc && (
              <>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Province</p>
                  <p className="text-base font-medium">{registration.province || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">LGU</p>
                  <p className="text-base font-medium">{registration.lgu || 'N/A'}</p>
                </div>
              </>
            )}
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
            <div>
              <p className="text-sm text-gray-500 mb-1">On Validation</p>
              <input
                type="checkbox"
                checked={isValidatingFlag(registration.is_validating)}
                disabled={!canToggleValidation() || validationSaving}
                onChange={(e) => void handleToggleValidation(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50"
                aria-label={`On Validation for ${registration.regid}`}
              />
              {validationError && (
                <p className="text-sm text-red-600">{validationError}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Validation No.</p>
              <p className="text-base font-medium tabular-nums">
                {registration.validation_no != null ? registration.validation_no : '—'}
              </p>
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

          {!isApprovedStatus(registration.status) && registration.status !== 'REJECTED' && (
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
          <div className={`bg-white rounded-lg shadow-md ${isAnc ? 'p-4 sm:p-5' : 'p-6'}`}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {`${registrationDetailParticipantsSectionTitle(registration.is_award)} (${participantSectionCount})`}
            </h2>
            <div className="overflow-x-auto w-full min-w-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                    >
                      Name
                    </th>
                    <th
                      className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                    >
                      Designation
                    </th>
                    {isAnc ? (
                      <>
                        <th
                          className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                        >
                          Province
                        </th>
                        <th
                          className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                        >
                          LGU
                        </th>
                        <th
                          className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                        >
                          PRC No.
                        </th>
                        <th
                          className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                        >
                          Expiry Date
                        </th>
                        <th
                          className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                        >
                          Provincial League
                        </th>
                      </>
                    ) : !conferenceIsAward(registration.is_award) ? (
                      <th
                        className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                      >
                        Barangay
                      </th>
                    ) : null}
                    {!conferenceIsAward(registration.is_award) && (
                      <th
                        className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                      >
                        T-Shirt Size
                      </th>
                    )}
                    <th
                      className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                    >
                      Food Preference
                    </th>
                    {!isApprovedStatus(registration.status) && (
                      <th
                        className={`${participantThPad} text-left text-xs font-medium text-gray-500 uppercase tracking-wider`}
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registration.regd.map((item, index) => (
                    <tr key={index}>
                      <td
                        className={`${participantTdPad} whitespace-nowrap text-sm font-medium text-gray-900`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {item.lastname}, {item.firstname} {item.middleinit || ''}
                          <button
                            type="button"
                            onClick={() => openNameEdit(item)}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50"
                            title="Edit name and designation"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </span>
                      </td>
                      <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
                        {item.designation || 'N/A'}
                      </td>
                      {isAnc ? (
                        <>
                          <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
                            {item.province || 'N/A'}
                          </td>
                          <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
                            {item.lgu || 'N/A'}
                          </td>
                          <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
                            {item.prcnum || 'N/A'}
                          </td>
                          <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
                            {formatDate(item.expirydate)}
                          </td>
                          <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
                            {registration.province || 'N/A'}
                          </td>
                        </>
                      ) : !conferenceIsAward(registration.is_award) ? (
                        <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
                          {item.brgy || 'N/A'}
                        </td>
                      ) : null}
                      {!conferenceIsAward(registration.is_award) && (
                        <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
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
                      )}
                      <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
                        {formatFoodPreference(item.food_preference) ?? (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {!isApprovedStatus(registration.status) && (
                        <td className={`${participantTdPad} whitespace-nowrap text-sm text-gray-500`}>
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
                  {participantToDelete.lastname}, {participantToDelete.firstname}{' '}
                  {participantToDelete.middleinit || ''}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-auto my-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Edit T-Shirt Size
            </h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Participant</p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm font-medium text-gray-900">
                  {participantToEditTshirt.lastname}, {participantToEditTshirt.firstname}{' '}
                  {participantToEditTshirt.middleinit || ''}
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

      {/* Edit Name & Designation Modal */}
      {participantToEditName && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-auto my-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Edit Name &amp; Designation
            </h2>
            <div className="space-y-3 mb-4">
              <div>
                <label htmlFor="name-edit-lastname" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name-edit-lastname"
                  type="text"
                  value={nameEditLastname}
                  onChange={(e) => setNameEditLastname(e.target.value.toUpperCase())}
                  disabled={nameSaving}
                  required
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="name-edit-firstname" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name-edit-firstname"
                  type="text"
                  value={nameEditFirstname}
                  onChange={(e) => setNameEditFirstname(e.target.value.toUpperCase())}
                  disabled={nameSaving}
                  required
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name-edit-middleinit" className="block text-sm font-medium text-gray-700 mb-1">
                    Middle Initial
                  </label>
                  <input
                    id="name-edit-middleinit"
                    type="text"
                    value={nameEditMiddleinit}
                    onChange={(e) => setNameEditMiddleinit(e.target.value.toUpperCase())}
                    disabled={nameSaving}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="name-edit-suffix" className="block text-sm font-medium text-gray-700 mb-1">
                    Suffix
                  </label>
                  <input
                    id="name-edit-suffix"
                    type="text"
                    value={nameEditSuffix}
                    onChange={(e) => setNameEditSuffix(e.target.value.toUpperCase())}
                    disabled={nameSaving}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="name-edit-designation" className="block text-sm font-medium text-gray-700 mb-1">
                  Designation <span className="text-red-500">*</span>
                </label>
                <select
                  id="name-edit-designation"
                  value={nameEditDesignation}
                  onChange={(e) => setNameEditDesignation(e.target.value.toUpperCase())}
                  disabled={nameSaving || positionsLoading}
                  required
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">
                    {positionsLoading ? 'Loading designations…' : 'Select designation'}
                  </option>
                  {(() => {
                    const options = positions.map((p) => p.name.toUpperCase());
                    if (nameEditDesignation && !options.includes(nameEditDesignation)) {
                      options.unshift(nameEditDesignation);
                    }
                    return options.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ));
                  })()}
                </select>
              </div>
            </div>
            {nameError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{nameError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeNameEdit}
                disabled={nameSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveName}
                disabled={nameSaving || positionsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
              >
                {nameSaving ? (
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

      {/* Edit registration contact (email, contact number) modal */}
      {showContactEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-auto my-8">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              Edit contact details
            </h2>
            <div className="space-y-4 mb-4">
              <div>
                <label htmlFor="contact-edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="contact-edit-email"
                  type="email"
                  value={contactEditEmail}
                  onChange={(e) => setContactEditEmail(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label htmlFor="contact-edit-num" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact number (11 digits)
                </label>
                <input
                  id="contact-edit-num"
                  type="tel"
                  value={contactEditNum}
                  onChange={(e) => setContactEditNum(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="09XXXXXXXXX"
                  maxLength={11}
                />
              </div>
            </div>
            {contactError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{contactError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowContactEdit(false);
                  setContactError('');
                }}
                disabled={contactSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                disabled={contactSaving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
              >
                {contactSaving ? (
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
    </>
  );
}
