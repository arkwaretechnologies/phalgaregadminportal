'use client';

import { useEffect } from 'react';

interface PaginationProps {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number | 'all';
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (value: number | 'all') => void;
  itemLabel?: string;
}

export default function Pagination({
  totalItems,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemLabel = 'items',
}: PaginationProps) {
  const itemsPerPageNum = itemsPerPage === 'all' ? totalItems : itemsPerPage;
  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalItems / itemsPerPageNum);
  const startIndex = itemsPerPage === 'all' ? 0 : (currentPage - 1) * itemsPerPageNum;
  const endIndex = itemsPerPage === 'all' ? totalItems : startIndex + itemsPerPageNum;

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      onPageChange(1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleItemsPerPageChange = (value: string) => {
    if (value === 'all') {
      onItemsPerPageChange('all');
    } else {
      onItemsPerPageChange(parseInt(value, 10));
    }
  };

  const getShowingText = () => {
    if (totalItems === 0) {
      return `No ${itemLabel}`;
    }
    if (itemsPerPage === 'all') {
      return `Showing all ${totalItems} ${itemLabel}`;
    }
    if (Math.min(endIndex, totalItems) === totalItems && totalItems < itemsPerPageNum) {
      return `Showing all ${totalItems} of ${totalItems} ${itemLabel}`;
    }
    return `Showing ${startIndex + 1} to ${Math.min(endIndex, totalItems)} of ${totalItems} ${itemLabel}`;
  };

  return (
    <div className="space-y-4">
      {/* Items per page selector */}
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
          <span className="text-sm text-gray-500">{getShowingText()}</span>
        </div>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
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
      )}
    </div>
  );
}

