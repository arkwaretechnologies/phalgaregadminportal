'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Registration, RegistrationDetail } from '@/types';
import ApprovalModal from './ApprovalModal';
import RegistrationDetailModal from './RegistrationDetailModal';
import CountdownTimer from './CountdownTimer';
import LoadingSpinner from './LoadingSpinner';

interface RegistrationListProps {
  initialRegistrations: Registration[];
  onRegistrationsChanged?: () => void;
  confcode?: string | null;
}

export default function RegistrationList({
  initialRegistrations,
  onRegistrationsChanged,
  confcode,
}: RegistrationListProps) {
  const [registrations, setRegistrations] = useState<Registration[]>(initialRegistrations);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [registrationDetail, setRegistrationDetail] = useState<RegistrationDetail | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(20);
  const [viewLoadingIdentifier, setViewLoadingIdentifier] = useState<string | number | null>(null);

  const autoRejectInFlight = useRef<Set<string>>(new Set());
  const hasRefreshedAfterAutoReject = useRef(false);
  const AUTO_REJECT_REFRESH_KEY = 'phalga:autoRejectRefreshed';
  const AUTO_REJECT_REMARK =
    'Unable to Upload Payment Proof within 24 hours of submission.';

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (confcode) {
        params.append('confcode', confcode);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/registrations?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setRegistrations(data.registrations || []);
        setCurrentPage(1); // Reset to first page when filters change
        onRegistrationsChanged?.();
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  }, [confcode, statusFilter, searchQuery, onRegistrationsChanged]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    hasRefreshedAfterAutoReject.current =
      window.sessionStorage.getItem(AUTO_REJECT_REFRESH_KEY) === '1';
  }, []);

  // Calculate pagination
  const totalItems = registrations.length;
  const itemsPerPageNum = itemsPerPage === 'all' ? totalItems : itemsPerPage;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPageNum);
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPageNum;
  const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + itemsPerPageNum;
  const paginatedRegistrations = registrations.slice(startIndex, endIndex);

  // Reset to page 1 when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleItemsPerPageChange = (value: string) => {
    if (value === 'all') {
      setItemsPerPage('all');
    } else {
      setItemsPerPage(parseInt(value, 10));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRegistrations();
  };

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
            REJECTED
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

  const formatTime = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleApproveReject = (registration: Registration) => {
    setSelectedRegistration(registration);
    setShowApprovalModal(true);
  };

  const handleViewDetails = async (registration: Registration) => {
    try {
      // Use batchnum if available, otherwise use regid for pending registrations
      const identifier = registration.batchnum || registration.regid;
      setViewLoadingIdentifier(identifier);
      
      // Use regid if batchnum is null, otherwise use batchnum
      const url = registration.batchnum 
        ? `/api/registrations/${registration.batchnum}`
        : `/api/registrations/${encodeURIComponent(registration.regid)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        setRegistrationDetail(data.registration);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error fetching registration details:', error);
    } finally {
      const identifier = registration.batchnum || registration.regid;
      setViewLoadingIdentifier((cur) => (cur === identifier ? null : cur));
    }
  };

  const handleApprovalSuccess = () => {
    setShowApprovalModal(false);
    setSelectedRegistration(null);
    fetchRegistrations();
  };

  const handleDetailUpdate = () => {
    fetchRegistrations();
  };

  const handleAutoRejectExpired = useCallback(
    async (registration: Registration) => {
      const regid = registration.regid;
      const normalizedStatus = registration.status?.toUpperCase() || null;

      if (normalizedStatus !== 'PENDING') return;
      if (autoRejectInFlight.current.has(regid)) return;

      autoRejectInFlight.current.add(regid);
      try {
        const response = await fetch('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            regid: registration.regid,
            batchnum: registration.batchnum || undefined,
            status: 'REJECTED',
            remarks: AUTO_REJECT_REMARK,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => null);
          console.error('Auto-reject failed:', err || response.statusText);
          return;
        }

        // Update local UI immediately
        setRegistrations((prev) =>
          prev.map((r) =>
              r.regid === regid
              ? { ...r, status: 'REJECTED', remarks: AUTO_REJECT_REMARK }
              : r
          )
        );
        onRegistrationsChanged?.();

        // Refresh exactly once (requested) after sending
        if (
          typeof window !== 'undefined' &&
          !hasRefreshedAfterAutoReject.current
        ) {
          hasRefreshedAfterAutoReject.current = true;
          window.sessionStorage.setItem(AUTO_REJECT_REFRESH_KEY, '1');
          window.location.reload();
        }
      } finally {
        autoRejectInFlight.current.delete(regid);
      }
    },
    [AUTO_REJECT_REMARK, onRegistrationsChanged]
  );

  return (
    <>
      <div>
        {/* Enhanced Filters */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Search Section */}
              <div className="flex-1">
                <label htmlFor="search" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </label>
                <form onSubmit={handleSearch} className="relative">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by Registration ID, email, or contact person..."
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white text-gray-700 placeholder-gray-400 font-medium"
                    />
                  </div>
                </form>
              </div>

              {/* Status Filter Section */}
              <div className="lg:w-64">
                <label htmlFor="status" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Status Filter
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <select
                    id="status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 font-medium appearance-none cursor-pointer"
                  >
                    <option value="all">All Registrations</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-3 text-gray-500">
              <LoadingSpinner />
              <span className="text-sm font-medium">Loading registrations…</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && registrations.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">No registrations found</p>
          </div>
        )}

        {/* Registration table */}
        {!loading && registrations.length > 0 && (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-4">
              {paginatedRegistrations.map((registration) => (
                <div
                  key={registration.batchnum || registration.regid}
                  className="bg-white rounded-2xl shadow-md border border-gray-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {registration.regid}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(registration.regdate)} • {formatTime(registration.regdate)}
                      </p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(registration.status)}</div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-gray-500">Province</span>
                      <span className="text-gray-900 text-right">
                        {registration.province || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-gray-500">LGU</span>
                      <span className="text-gray-900 text-right">{registration.lgu || 'N/A'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-gray-500">Contact</span>
                      <span className="text-gray-900 text-right">
                        {registration.contactperson || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-gray-500">Email</span>
                      <span className="text-gray-900 text-right break-all">
                        {registration.email || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-gray-500">Participants</span>
                      <span className="text-gray-900 text-right tabular-nums">
                        {registration.participant_count ?? 0}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">Time left</span>
                    <CountdownTimer
                      registrationDate={registration.regdate}
                      status={registration.status}
                      onExpired={() => handleAutoRejectExpired(registration)}
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      onClick={() => handleViewDetails(registration)}
                      disabled={viewLoadingIdentifier === (registration.batchnum || registration.regid)}
                      className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="View Details"
                    >
                      {viewLoadingIdentifier === (registration.batchnum || registration.regid) ? (
                        <span className="inline-flex items-center gap-2">
                          <LoadingSpinner />
                          <span>Loading…</span>
                        </span>
                      ) : (
                        'View details'
                      )}
                    </button>
                    {registration.status !== 'APPROVED' &&
                      registration.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleApproveReject(registration)}
                          className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                          title="Approve or Reject"
                        >
                          Review
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
              {/* Items per page selector */}
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="itemsPerPage" className="text-sm font-medium text-gray-700">
                    Show:
                  </label>
                  <select
                    id="itemsPerPage"
                    value={itemsPerPage === 'all' ? 'all' : itemsPerPage.toString()}
                    onChange={(e) => handleItemsPerPageChange(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white text-gray-900"
                  >
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="all">ALL</option>
                  </select>
                  <span className="text-sm text-gray-500">
                    {totalItems === 0 ? (
                      'No registrations'
                    ) : itemsPerPage === 'all' ? (
                      `Showing all ${totalItems} registrations`
                    ) : Math.min(endIndex, totalItems) === totalItems && totalItems < itemsPerPageNum ? (
                      `Showing all ${totalItems} of ${totalItems} registrations`
                    ) : (
                      `Showing ${startIndex + 1} to ${Math.min(endIndex, totalItems)} of ${totalItems} registrations`
                    )}
                  </span>
                </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registration ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registration Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Province
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        LGU
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact Person
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Participants
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time Left
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedRegistrations.map((registration) => (
                    <tr key={registration.batchnum || registration.regid} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {registration.regid}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          <div>{formatDate(registration.regdate)}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatTime(registration.regdate)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {registration.province || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {registration.lgu || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {registration.contactperson || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {registration.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 tabular-nums">
                          {registration.participant_count ?? 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(registration.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDetails(registration)}
                            disabled={viewLoadingIdentifier === (registration.batchnum || registration.regid)}
                            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="View Details"
                          >
                            {viewLoadingIdentifier === (registration.batchnum || registration.regid) ? (
                              <span className="inline-flex items-center gap-2">
                                <LoadingSpinner />
                                <span>Loading…</span>
                              </span>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                              </>
                            )}
                          </button>
                          {registration.status !== 'APPROVED' && registration.status !== 'REJECTED' && (
                            <button
                              onClick={() => handleApproveReject(registration)}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-700 hover:border-indigo-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 shadow-sm hover:shadow"
                              title="Approve or Reject"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Review
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <CountdownTimer
                          registrationDate={registration.regdate}
                          status={registration.status}
                          onExpired={() => handleAutoRejectExpired(registration)}
                        />
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="mt-4 bg-white px-4 sm:px-6 py-4 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1 overflow-x-auto max-w-[70vw] sm:max-w-none">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                            currentPage === pageNum
                              ? 'bg-indigo-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Next
                  </button>
                </div>
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedRegistration && (
        <ApprovalModal
          registration={selectedRegistration}
          isOpen={showApprovalModal}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedRegistration(null);
          }}
          onSuccess={handleApprovalSuccess}
        />
      )}

      {registrationDetail && (
        <RegistrationDetailModal
          registration={registrationDetail}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setRegistrationDetail(null);
          }}
          onUpdate={handleDetailUpdate}
        />
      )}
    </>
  );
}


