'use client';

import { useState, useEffect } from 'react';
import { Conference } from '@/types';

export default function ConferencesClient() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConference, setEditingConference] = useState<Conference | null>(null);
  const [formData, setFormData] = useState({
    confcode: '',
    name: '',
    date_from: '',
    date_to: '',
    venue: '',
    reg_limit: '',
    domain: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchConferences = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/conferences');
      const data = await response.json();

      if (response.ok) {
        setConferences(data.conferences || []);
      } else {
        setError(data.error || 'Failed to fetch conferences');
      }
    } catch (error) {
      console.error('Error fetching conferences:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load conferences on mount
  useEffect(() => {
    fetchConferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    setEditingConference(null);
    setFormData({
      confcode: '',
      name: '',
      date_from: '',
      date_to: '',
      venue: '',
      reg_limit: '',
      domain: '',
    });
    setError('');
    setSuccess('');
    setShowAddForm(true);
  };

  const handleEdit = (conference: Conference) => {
    setEditingConference(conference);
    setFormData({
      confcode: conference.confcode,
      name: conference.name || '',
      date_from: conference.date_from ? conference.date_from.split('T')[0] : '',
      date_to: conference.date_to ? conference.date_to.split('T')[0] : '',
      venue: conference.venue || '',
      reg_limit: conference.reg_limit?.toString() || '',
      domain: conference.domain || '',
    });
    setError('');
    setSuccess('');
    setShowAddForm(true);
  };

  const handleDelete = async (confcode: string) => {
    if (!confirm(`Are you sure you want to delete conference "${confcode}"?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/conferences/${encodeURIComponent(confcode)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Conference deleted successfully');
        fetchConferences();
      } else {
        setError(data.error || 'Failed to delete conference');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const url = editingConference
        ? `/api/conferences/${encodeURIComponent(editingConference.confcode)}`
        : '/api/conferences';
      const method = editingConference ? 'PUT' : 'POST';

      const body: any = {
        confcode: formData.confcode.trim(),
        name: formData.name.trim() || null,
        date_from: formData.date_from || null,
        date_to: formData.date_to || null,
        venue: formData.venue.trim() || null,
        reg_limit: formData.reg_limit ? parseInt(formData.reg_limit, 10) : null,
        domain: formData.domain.trim() || null,
      };

      // Include confcode in PUT request if it has changed
      if (editingConference && formData.confcode.trim() === editingConference.confcode) {
        // If confcode hasn't changed, don't send it (use URL param)
        delete body.confcode;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(editingConference ? 'Conference updated successfully' : 'Conference created successfully');
        setShowAddForm(false);
        setFormData({
          confcode: '',
          name: '',
          date_from: '',
          date_to: '',
          venue: '',
          reg_limit: '',
          domain: '',
        });
        setEditingConference(null);
        fetchConferences();
      } else {
        setError(data.error || 'Failed to save conference');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conference Management</h1>
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
          disabled={loading}
        >
          Add Conference
        </button>
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

      {showAddForm && (
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingConference ? 'Edit Conference' : 'Add New Conference'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="confcode" className="block text-sm font-medium text-gray-700 mb-2">
                  Conference Code {!editingConference && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  id="confcode"
                  value={formData.confcode}
                  onChange={(e) => setFormData({ ...formData, confcode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                  disabled={loading}
                  placeholder="Enter conference code"
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                  placeholder="Enter conference name"
                />
              </div>
              <div>
                <label htmlFor="date_from" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="date_from"
                  value={formData.date_from}
                  onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="date_to" className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  id="date_to"
                  value={formData.date_to}
                  onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-2">
                  Venue
                </label>
                <input
                  type="text"
                  id="venue"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                  placeholder="Enter venue"
                />
              </div>
              <div>
                <label htmlFor="reg_limit" className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Limit
                </label>
                <input
                  type="number"
                  id="reg_limit"
                  value={formData.reg_limit}
                  onChange={(e) => setFormData({ ...formData, reg_limit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                  min="0"
                  step="1"
                  placeholder="Enter registration limit"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                  Domain
                </label>
                <input
                  type="text"
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                  placeholder="Enter domain"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingConference(null);
                  setFormData({
                    confcode: '',
                    name: '',
                    date_from: '',
                    date_to: '',
                    venue: '',
                    reg_limit: '',
                    domain: '',
                  });
                  setError('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingConference ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && !showAddForm ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading conferences...</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {conferences.map((conference) => (
              <div
                key={conference.confcode}
                className="bg-white rounded-2xl shadow-md border border-gray-100 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{conference.confcode}</p>
                    {conference.name && (
                      <p className="text-sm text-gray-600 mt-1 truncate">{conference.name}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  {conference.date_from && conference.date_to && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Dates</span>
                      <span className="text-gray-700">
                        {formatDate(conference.date_from)} - {formatDate(conference.date_to)}
                      </span>
                    </div>
                  )}
                  {conference.venue && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Venue</span>
                      <span className="text-gray-700 truncate ml-2">{conference.venue}</span>
                    </div>
                  )}
                  {conference.reg_limit !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Limit</span>
                      <span className="text-gray-700">{conference.reg_limit}</span>
                    </div>
                  )}
                  {conference.domain && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Domain</span>
                      <span className="text-gray-700 truncate ml-2">{conference.domain}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleEdit(conference)}
                    className="w-full px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(conference.confcode)}
                    className="w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {conferences.length === 0 && (
              <div className="text-center py-8 bg-white rounded-2xl shadow-md border border-gray-100">
                <p className="text-gray-500">No conferences found</p>
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
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Venue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Limit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {conferences.map((conference) => (
                    <tr key={conference.confcode}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {conference.confcode}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conference.name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conference.date_from && conference.date_to
                          ? `${formatDate(conference.date_from)} - ${formatDate(conference.date_to)}`
                          : conference.date_from
                            ? formatDate(conference.date_from)
                            : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conference.venue || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conference.reg_limit !== null ? conference.reg_limit : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {conference.domain || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(conference)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(conference.confcode)}
                          className="text-red-600 hover:text-red-900"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {conferences.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No conferences found</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
