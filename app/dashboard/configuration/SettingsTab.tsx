'use client';

import { useState, useEffect } from 'react';
import { Bank, Contact, Conference } from '@/types';

interface BankFormData {
  bank_name: string;
  acct_no: string;
  payee: string;
}

interface ContactFormData {
  contact_no: string;
}

export default function SettingsTab() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [selectedConference, setSelectedConference] = useState<string>('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [banksLoading, setBanksLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bank modal state
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankForm, setBankForm] = useState<BankFormData>({ bank_name: '', acct_no: '', payee: '' });
  const [bankSaving, setBankSaving] = useState(false);
  const [deletingBankId, setDeletingBankId] = useState<number | null>(null);

  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormData>({ contact_no: '' });
  const [contactSaving, setContactSaving] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<number | null>(null);

  // Fetch conferences on mount
  useEffect(() => {
    fetchConferences();
  }, []);

  // Fetch banks and contacts when conference changes
  useEffect(() => {
    if (selectedConference) {
      fetchBanks();
      fetchContacts();
    } else {
      setBanks([]);
      setContacts([]);
    }
  }, [selectedConference]);

  const fetchConferences = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/conferences');
      const data = await response.json();
      if (response.ok) {
        setConferences(data.conferences || []);
        // Auto-select first conference if available
        if (data.conferences && data.conferences.length > 0) {
          setSelectedConference(data.conferences[0].confcode);
        }
      } else {
        setError(data.error || 'Failed to fetch conferences');
      }
    } catch (err) {
      console.error('Error fetching conferences:', err);
      setError('An error occurred while fetching conferences');
    } finally {
      setLoading(false);
    }
  };

  const fetchBanks = async () => {
    if (!selectedConference) return;
    setBanksLoading(true);
    try {
      const response = await fetch(`/api/banks?confcode=${encodeURIComponent(selectedConference)}`);
      const data = await response.json();
      if (response.ok) {
        setBanks(data.banks || []);
      } else {
        setError(data.error || 'Failed to fetch banks');
      }
    } catch (err) {
      console.error('Error fetching banks:', err);
      setError('An error occurred while fetching banks');
    } finally {
      setBanksLoading(false);
    }
  };

  const fetchContacts = async () => {
    if (!selectedConference) return;
    setContactsLoading(true);
    try {
      const response = await fetch(`/api/contacts?confcode=${encodeURIComponent(selectedConference)}`);
      const data = await response.json();
      if (response.ok) {
        setContacts(data.contacts || []);
      } else {
        setError(data.error || 'Failed to fetch contacts');
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setError('An error occurred while fetching contacts');
    } finally {
      setContactsLoading(false);
    }
  };

  // Bank CRUD operations
  const openAddBankModal = () => {
    setEditingBank(null);
    setBankForm({ bank_name: '', acct_no: '', payee: '' });
    setShowBankModal(true);
  };

  const openEditBankModal = (bank: Bank) => {
    setEditingBank(bank);
    setBankForm({
      bank_name: bank.bank_name,
      acct_no: bank.acct_no,
      payee: bank.payee,
    });
    setShowBankModal(true);
  };

  const closeBankModal = () => {
    setShowBankModal(false);
    setEditingBank(null);
    setBankForm({ bank_name: '', acct_no: '', payee: '' });
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.bank_name.trim() || !bankForm.acct_no.trim() || !bankForm.payee.trim()) {
      setError('All bank fields are required');
      return;
    }

    setBankSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingBank) {
        // Update existing bank
        const response = await fetch(`/api/banks/${editingBank.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bankForm),
        });
        const data = await response.json();
        if (response.ok) {
          setSuccess('Bank updated successfully');
          closeBankModal();
          fetchBanks();
        } else {
          setError(data.error || 'Failed to update bank');
        }
      } else {
        // Create new bank
        const response = await fetch('/api/banks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...bankForm, confcode: selectedConference }),
        });
        const data = await response.json();
        if (response.ok) {
          setSuccess('Bank added successfully');
          closeBankModal();
          fetchBanks();
        } else {
          setError(data.error || 'Failed to add bank');
        }
      }
    } catch (err) {
      console.error('Error saving bank:', err);
      setError('An error occurred while saving bank');
    } finally {
      setBankSaving(false);
    }
  };

  const handleDeleteBank = async (bank: Bank) => {
    if (!confirm(`Are you sure you want to delete bank "${bank.bank_name}"?`)) {
      return;
    }

    setDeletingBankId(bank.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/banks/${bank.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok) {
        setSuccess('Bank deleted successfully');
        fetchBanks();
      } else {
        setError(data.error || 'Failed to delete bank');
      }
    } catch (err) {
      console.error('Error deleting bank:', err);
      setError('An error occurred while deleting bank');
    } finally {
      setDeletingBankId(null);
    }
  };

  // Contact CRUD operations
  const openAddContactModal = () => {
    setEditingContact(null);
    setContactForm({ contact_no: '' });
    setShowContactModal(true);
  };

  const openEditContactModal = (contact: Contact) => {
    setEditingContact(contact);
    setContactForm({
      contact_no: contact.contact_no || '',
    });
    setShowContactModal(true);
  };

  const closeContactModal = () => {
    setShowContactModal(false);
    setEditingContact(null);
    setContactForm({ contact_no: '' });
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.contact_no.trim()) {
      setError('Contact number is required');
      return;
    }

    // Validate exactly 11 digits
    const digitsOnly = contactForm.contact_no.replace(/\D/g, '');
    if (digitsOnly.length !== 11) {
      setError('Contact number must be exactly 11 digits');
      return;
    }

    setContactSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingContact) {
        // Update existing contact
        const response = await fetch(`/api/contacts/${editingContact.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactForm),
        });
        const data = await response.json();
        if (response.ok) {
          setSuccess('Contact updated successfully');
          closeContactModal();
          fetchContacts();
        } else {
          setError(data.error || 'Failed to update contact');
        }
      } else {
        // Create new contact
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...contactForm, confcode: selectedConference }),
        });
        const data = await response.json();
        if (response.ok) {
          setSuccess('Contact added successfully');
          closeContactModal();
          fetchContacts();
        } else {
          setError(data.error || 'Failed to add contact');
        }
      }
    } catch (err) {
      console.error('Error saving contact:', err);
      setError('An error occurred while saving contact');
    } finally {
      setContactSaving(false);
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Are you sure you want to delete contact "${contact.contact_no}"?`)) {
      return;
    }

    setDeletingContactId(contact.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (response.ok) {
        setSuccess('Contact deleted successfully');
        fetchContacts();
      } else {
        setError(data.error || 'Failed to delete contact');
      }
    } catch (err) {
      console.error('Error deleting contact:', err);
      setError('An error occurred while deleting contact');
    } finally {
      setDeletingContactId(null);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Settings</h2>
        <p className="text-sm text-gray-500">Manage bank details and contact information for each conference</p>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Conference Selector */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <label htmlFor="conference-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Conference
        </label>
        <select
          id="conference-select"
          value={selectedConference}
          onChange={(e) => setSelectedConference(e.target.value)}
          className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">-- Select a conference --</option>
          {conferences.map((conf) => (
            <option key={conf.confcode} value={conf.confcode}>
              {conf.confcode} - {conf.name || 'Unnamed'}
            </option>
          ))}
        </select>
      </div>

      {selectedConference && (
        <>
          {/* Bank Details Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Bank Details</h3>
                </div>
                <button
                  onClick={openAddBankModal}
                  className="px-4 py-2 text-sm font-medium text-emerald-600 bg-white hover:bg-gray-50 rounded-lg transition-colors"
                >
                  + Add Bank
                </button>
              </div>
            </div>

            <div className="p-6">
              {banksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                </div>
              ) : banks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <p>No bank details found for this conference</p>
                  <button
                    onClick={openAddBankModal}
                    className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Add your first bank
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {banks.map((bank) => (
                    <div
                      key={bank.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">{bank.bank_name}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{bank.acct_no}</span>
                          <span className="mx-2">•</span>
                          <span>{bank.payee}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => openEditBankModal(bank)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteBank(bank)}
                          disabled={deletingBankId === bank.id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingBankId === bank.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contact Details Section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Contact Numbers</h3>
                </div>
                <button
                  onClick={openAddContactModal}
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-white hover:bg-gray-50 rounded-lg transition-colors"
                >
                  + Add Contact
                </button>
              </div>
            </div>

            <div className="p-6">
              {contactsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <p>No contact numbers found for this conference</p>
                  <button
                    onClick={openAddContactModal}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Add your first contact
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <span className="font-medium text-gray-900">{contact.contact_no}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditContactModal(contact)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact)}
                          disabled={deletingContactId === contact.id}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingContactId === contact.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedConference && conferences.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-800">
              Please select a conference to manage bank and contact details.
            </p>
          </div>
        </div>
      )}

      {/* Bank Modal */}
      {showBankModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingBank ? 'Edit Bank Details' : 'Add Bank Details'}
              </h3>
            </div>
            <form onSubmit={handleSaveBank} className="p-6 space-y-4">
              <div>
                <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="bank_name"
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., BDO - Cagayan de Oro"
                />
              </div>
              <div>
                <label htmlFor="acct_no" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="acct_no"
                  value={bankForm.acct_no}
                  onChange={(e) => setBankForm({ ...bankForm, acct_no: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                  placeholder="e.g., 0119 4800 6438"
                />
              </div>
              <div>
                <label htmlFor="payee" className="block text-sm font-medium text-gray-700 mb-1">
                  Payee Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="payee"
                  value={bankForm.payee}
                  onChange={(e) => setBankForm({ ...bankForm, payee: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., Philippine Association of Local Government..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeBankModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bankSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bankSaving ? 'Saving...' : editingBank ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingContact ? 'Edit Contact Number' : 'Add Contact Number'}
              </h3>
            </div>
            <form onSubmit={handleSaveContact} className="p-6 space-y-4">
              <div>
                <label htmlFor="contact_no" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="contact_no"
                  value={contactForm.contact_no}
                  onChange={(e) => setContactForm({ ...contactForm, contact_no: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 09123456789"
                  maxLength={11}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be exactly 11 digits (e.g., 09123456789)
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeContactModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contactSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {contactSaving ? 'Saving...' : editingContact ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
