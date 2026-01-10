'use client';

import { useState, useEffect } from 'react';
import { Position } from '@/types';

export default function PositionsTab() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newPositionName, setNewPositionName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchPositions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/positions');
      const data = await response.json();

      if (response.ok) {
        setPositions(data.positions || []);
      } else {
        setError(data.error || 'Failed to fetch positions');
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPositionName.trim()) {
      setError('Position name is required');
      return;
    }

    setAdding(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newPositionName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Position added successfully');
        setNewPositionName('');
        fetchPositions();
      } else {
        setError(data.error || 'Failed to add position');
      }
    } catch (error) {
      console.error('Error adding position:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (positionId: number, positionName: string) => {
    if (!confirm(`Are you sure you want to delete position "${positionName}"?`)) {
      return;
    }

    setDeletingId(positionId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Position deleted successfully');
        fetchPositions();
      } else {
        setError(data.error || 'Failed to delete position');
      }
    } catch (error) {
      console.error('Error deleting position:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Positions</h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Add Position Form */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Position</h3>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            value={newPositionName}
            onChange={(e) => setNewPositionName(e.target.value)}
            placeholder="Enter position name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={adding || !newPositionName.trim()}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
      </div>

      {/* Positions List */}
      {loading ? (
        <div className="text-center py-8 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">Loading positions...</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {positions.map((position) => (
              <div
                key={position.position_id}
                className="bg-white rounded-lg shadow-md border border-gray-100 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{position.name}</p>
                  <button
                    onClick={() => handleDelete(position.position_id, position.name)}
                    disabled={deletingId === position.position_id}
                    className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === position.position_id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
            {positions.length === 0 && (
              <div className="text-center py-8 bg-white rounded-lg shadow-md border border-gray-100">
                <p className="text-gray-500">No positions found</p>
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Position Name
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {positions.map((position) => (
                    <tr key={position.position_id} className="hover:bg-gray-50">
                      <td className="px-6 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {position.name}
                      </td>
                      <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDelete(position.position_id, position.name)}
                          disabled={deletingId === position.position_id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === position.position_id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {positions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No positions found</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
