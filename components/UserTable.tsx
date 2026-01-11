'use client';

import { useState, useEffect } from 'react';
import { User, Conference } from '@/types';

interface UserTableProps {
  initialUsers: User[];
}

export default function UserTable({ initialUsers }: UserTableProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullname: '',
    role: 'reviewer' as 'admin' | 'reviewer',
    assigned_conferences: [] as string[],
    default_conference: '' as string,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availableSearch, setAvailableSearch] = useState('');
  const [assignedSearch, setAssignedSearch] = useState('');

  // Fetch conferences on component mount
  useEffect(() => {
    const fetchConferences = async () => {
      try {
        const response = await fetch('/api/conferences');
        const data = await response.json();
        if (response.ok) {
          setConferences(data.conferences || []);
        }
      } catch (error) {
        console.error('Error fetching conferences:', error);
      }
    };
    fetchConferences();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();

      if (response.ok) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      fullname: '',
      role: 'reviewer',
      assigned_conferences: [],
      default_conference: '',
    });
    setError('');
    setSuccess('');
    setAvailableSearch('');
    setAssignedSearch('');
    setShowAddForm(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      fullname: user.fullname,
      role: user.role,
      assigned_conferences: user.assigned_conferences || [],
      default_conference: user.default_conference || '',
    });
    setError('');
    setSuccess('');
    setAvailableSearch('');
    setAssignedSearch('');
    setShowAddForm(true);
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('User deleted successfully');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to delete user');
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
      const url = editingUser
        ? `/api/users/${editingUser.user_id}`
        : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const body = editingUser
        ? {
            fullname: formData.fullname,
            role: formData.role,
            assigned_conferences: formData.role === 'reviewer' ? formData.assigned_conferences : [],
            default_conference: formData.default_conference || null,
            ...(formData.password && { password: formData.password }),
          }
        : {
            ...formData,
            assigned_conferences: formData.role === 'reviewer' ? formData.assigned_conferences : [],
            default_conference: formData.default_conference || null,
          };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(editingUser ? 'User updated successfully' : 'User created successfully');
        setShowAddForm(false);
        setFormData({
          username: '',
          password: '',
          fullname: '',
          role: 'reviewer',
          assigned_conferences: [],
          default_conference: '',
        });
        setEditingUser(null);
        setAvailableSearch('');
        setAssignedSearch('');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to save user');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
        >
          Add User
        </button>
      </div>

      {error && !showAddForm && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* User Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => {
              if (!loading) {
                setShowAddForm(false);
                setEditingUser(null);
                setFormData({
                  username: '',
                  password: '',
                  fullname: '',
                  role: 'reviewer',
                  assigned_conferences: [],
                  default_conference: '',
                });
                setError('');
                setAvailableSearch('');
                setAssignedSearch('');
              }
            }}
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className={`relative w-full bg-white rounded-2xl shadow-2xl transform transition-all ${formData.role === 'reviewer' ? 'max-w-2xl' : 'max-w-lg'}`}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!loading) {
                      setShowAddForm(false);
                      setEditingUser(null);
                      setFormData({
                        username: '',
                        password: '',
                        fullname: '',
                        role: 'reviewer',
                        assigned_conferences: [],
                        default_conference: '',
                      });
                      setError('');
                      setAvailableSearch('');
                      setAssignedSearch('');
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={loading}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit}>
                <div className="px-6 py-5 space-y-4">
                  {/* Show error inside modal */}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Username {!editingUser && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="text"
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:text-gray-500"
                        required={!editingUser}
                        disabled={!!editingUser || loading}
                        placeholder="Enter username"
                      />
                    </div>
                    <div>
                      <label htmlFor="fullname" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="fullname"
                        value={formData.fullname}
                        onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        required
                        disabled={loading}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Password {!editingUser && <span className="text-red-500">*</span>}
                        {editingUser && <span className="text-gray-400 text-xs ml-1">(leave blank to keep current)</span>}
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        required={!editingUser}
                        disabled={loading}
                        placeholder={editingUser ? "New password (optional)" : "Min. 8 characters"}
                        minLength={editingUser ? 0 : 8}
                      />
                    </div>
                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="role"
                        value={formData.role}
                        onChange={(e) => {
                          const newRole = e.target.value as 'admin' | 'reviewer';
                          const newAssigned = newRole === 'admin' ? [] : formData.assigned_conferences;
                          // Clear default if switching to reviewer and current default is not in assigned list
                          const newDefault = newRole === 'reviewer' && formData.default_conference && !newAssigned.includes(formData.default_conference)
                            ? ''
                            : formData.default_conference;
                          setFormData({ 
                            ...formData, 
                            role: newRole,
                            assigned_conferences: newAssigned,
                            default_conference: newDefault
                          });
                        }}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 transition-colors"
                        required
                        disabled={loading}
                      >
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  {/* Conference Assignment Dual List - Only for Reviewer role */}
                  {formData.role === 'reviewer' && (() => {
                    // Filter available conferences based on search
                    const availableConferences = conferences
                      .filter(conf => !formData.assigned_conferences.includes(conf.confcode))
                      .filter(conf => 
                        availableSearch === '' ||
                        conf.confcode.toLowerCase().includes(availableSearch.toLowerCase()) ||
                        (conf.name && conf.name.toLowerCase().includes(availableSearch.toLowerCase()))
                      );
                    
                    // Filter assigned conferences based on search
                    const assignedConferences = formData.assigned_conferences
                      .map(confcode => conferences.find(c => c.confcode === confcode))
                      .filter((conf): conf is Conference => conf !== undefined)
                      .filter(conf =>
                        assignedSearch === '' ||
                        conf.confcode.toLowerCase().includes(assignedSearch.toLowerCase()) ||
                        (conf.name && conf.name.toLowerCase().includes(assignedSearch.toLowerCase()))
                      );

                    // All available (unfiltered) for move all
                    const allAvailable = conferences.filter(conf => !formData.assigned_conferences.includes(conf.confcode));

                    return (
                      <div className="mt-5 pt-5 border-t border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Assigned Conferences
                          <span className="text-gray-400 text-xs ml-2 font-normal">(Reviewer can only see registrations from assigned conferences)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Available Conferences */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Available ({allAvailable.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  // Move all available (that match search) to assigned
                                  const toAdd = availableConferences.map(c => c.confcode);
                                  setFormData({
                                    ...formData,
                                    assigned_conferences: [...formData.assigned_conferences, ...toAdd]
                                  });
                                  setAvailableSearch('');
                                }}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading || availableConferences.length === 0}
                              >
                                Add All {availableSearch && availableConferences.length < allAvailable.length ? `(${availableConferences.length})` : ''} →
                              </button>
                            </div>
                            {/* Search input for available */}
                            <div className="relative mb-2">
                              <input
                                type="text"
                                placeholder="Search available..."
                                value={availableSearch}
                                onChange={(e) => setAvailableSearch(e.target.value)}
                                className="w-full px-3 py-1.5 pl-8 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={loading}
                              />
                              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              {availableSearch && (
                                <button
                                  type="button"
                                  onClick={() => setAvailableSearch('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div className="border border-gray-300 rounded-lg h-48 overflow-y-auto bg-gray-50">
                              {availableConferences.map(conf => (
                                <button
                                  key={conf.confcode}
                                  type="button"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      assigned_conferences: [...formData.assigned_conferences, conf.confcode]
                                    });
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 border-b border-gray-200 last:border-b-0 transition-colors flex items-center justify-between group"
                                  disabled={loading}
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-gray-900">{conf.confcode}</span>
                                    {conf.name && <span className="text-gray-500 ml-2 text-xs truncate">{conf.name}</span>}
                                  </div>
                                  <svg className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              ))}
                              {availableConferences.length === 0 && (
                                <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                  {availableSearch ? 'No matching conferences' : 'No available conferences'}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Assigned Conferences */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Assigned ({formData.assigned_conferences.length})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  // Remove all assigned (that match search)
                                  const toRemove = assignedConferences.map(c => c.confcode);
                                  const newAssigned = formData.assigned_conferences.filter(c => !toRemove.includes(c));
                                  // Clear default if it's being removed
                                  const newDefault = formData.default_conference && !newAssigned.includes(formData.default_conference) ? '' : formData.default_conference;
                                  setFormData({
                                    ...formData,
                                    assigned_conferences: newAssigned,
                                    default_conference: newDefault
                                  });
                                  setAssignedSearch('');
                                }}
                                className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading || assignedConferences.length === 0}
                              >
                                ← Remove All {assignedSearch && assignedConferences.length < formData.assigned_conferences.length ? `(${assignedConferences.length})` : ''}
                              </button>
                            </div>
                            {/* Search input for assigned */}
                            <div className="relative mb-2">
                              <input
                                type="text"
                                placeholder="Search assigned..."
                                value={assignedSearch}
                                onChange={(e) => setAssignedSearch(e.target.value)}
                                className="w-full px-3 py-1.5 pl-8 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-indigo-50/30"
                                disabled={loading}
                              />
                              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              {assignedSearch && (
                                <button
                                  type="button"
                                  onClick={() => setAssignedSearch('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div className="border border-indigo-200 rounded-lg h-48 overflow-y-auto bg-indigo-50/30">
                              {assignedConferences.map(conf => (
                                <button
                                  key={conf.confcode}
                                  type="button"
                                  onClick={() => {
                                    const newAssigned = formData.assigned_conferences.filter(c => c !== conf.confcode);
                                    // Clear default if this conference was the default
                                    const newDefault = formData.default_conference === conf.confcode ? '' : formData.default_conference;
                                    setFormData({
                                      ...formData,
                                      assigned_conferences: newAssigned,
                                      default_conference: newDefault
                                    });
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 border-b border-indigo-100 last:border-b-0 transition-colors flex items-center justify-between group"
                                  disabled={loading}
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium text-gray-900">{conf.confcode}</span>
                                    {conf.name && <span className="text-gray-500 ml-2 text-xs truncate">{conf.name}</span>}
                                  </div>
                                  <svg className="w-4 h-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              ))}
                              {assignedConferences.length === 0 && (
                                <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                  {assignedSearch ? 'No matching conferences' : 'No conferences assigned'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Click on a conference to move it between lists. Use search to filter, then &quot;Add All&quot; or &quot;Remove All&quot; to move filtered items.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Default Conference Selector - for all users */}
                  <div className="mt-5 pt-5 border-t border-gray-200">
                    <label htmlFor="default_conference" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Default Conference
                      <span className="text-gray-400 text-xs ml-2 font-normal">(Pre-selected when opening pages)</span>
                    </label>
                    <select
                      id="default_conference"
                      value={formData.default_conference}
                      onChange={(e) => setFormData({ ...formData, default_conference: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 transition-colors"
                      disabled={loading}
                    >
                      <option value="">Use first available conference</option>
                      {(formData.role === 'reviewer' 
                        ? conferences.filter(c => formData.assigned_conferences.includes(c.confcode))
                        : conferences
                      ).map((conf) => (
                        <option key={conf.confcode} value={conf.confcode}>
                          {conf.confcode} - {conf.name || 'Unnamed Conference'}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.role === 'reviewer' 
                        ? 'Only assigned conferences can be set as default.'
                        : 'Select which conference to show by default when this user opens pages.'}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingUser(null);
                      setFormData({
                        username: '',
                        password: '',
                        fullname: '',
                        role: 'reviewer',
                        assigned_conferences: [],
                        default_conference: '',
                      });
                      setError('');
                      setAvailableSearch('');
                      setAssignedSearch('');
                    }}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {loading && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {loading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {loading && !showAddForm ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading users...</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {users.map((user) => (
              <div
                key={user.user_id}
                className="bg-white rounded-2xl shadow-md border border-gray-100 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.username}</p>
                    <p className="text-sm text-gray-600 mt-1 truncate">{user.fullname}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full shrink-0 ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-700">{formatDate(user.created_at)}</span>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleEdit(user)}
                    className="w-full px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(user.user_id)}
                    className="w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-8 bg-white rounded-2xl shadow-md border border-gray-100">
                <p className="text-gray-500">No users found</p>
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
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Full Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.user_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.fullname}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.user_id)}
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
            {users.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No users found</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


