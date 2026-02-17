'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bank, Contact, Conference } from '@/types';

interface BankFormData {
  bank_name: string;
  acct_no: string;
  payee: string;
}

interface ContactFormData {
  contact_no: string;
}

interface AppConfig {
  REGISTRATION_LIMIT: string;
  DEFAULT_CONFERENCE: string;
}

interface LguItem {
  psgc: string;
  lguname: string | null;
  geolevel: string | null;
}

interface ProvinceWithLgus {
  name: string;
  psgc: string;
  lgus: LguItem[];
}

interface LguLimitEntry {
  psgcode: string | null;
  geolevel: string | null;
  reg_limit: number | null;
}

/** Per-PSGC limit: geolevel = PROV (province-wide) or CITY/MUN/HUC (specific LGU) */
interface LguLimitOverride {
  unlimited: boolean;
  value: number;
  geolevel: string;
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

  // Application config state
  const [appConfig, setAppConfig] = useState<AppConfig>({
    REGISTRATION_LIMIT: '',
    DEFAULT_CONFERENCE: '',
  });
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);

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

  // Conference limit edit modal
  const [editingConferenceLimit, setEditingConferenceLimit] = useState<Conference | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<string>('');
  const [conferenceLimitSaving, setConferenceLimitSaving] = useState(false);

  // LGU limits (per conference): provinces with LGUs, saved limits, and local overrides
  const [lguProvinces, setLguProvinces] = useState<ProvinceWithLgus[]>([]);
  const [lguLimitsLoading, setLguLimitsLoading] = useState(false);
  const [lguLimitsSaving, setLguLimitsSaving] = useState(false);
  /** Key = psgcode; value = { unlimited, value } for form state */
  const [lguLimitOverrides, setLguLimitOverrides] = useState<Record<string, LguLimitOverride>>({});
  // Search form for adding/editing one LGU limit
  const [provinceSearch, setProvinceSearch] = useState('');
  const [lguSearch, setLguSearch] = useState('');
  const [selectedLguForLimit, setSelectedLguForLimit] = useState<(LguItem & { provinceName: string }) | null>(null);
  const [lguFormUnlimited, setLguFormUnlimited] = useState(true);
  const [lguFormLimitValue, setLguFormLimitValue] = useState(0);
  const [showProvinceList, setShowProvinceList] = useState(false);
  const [showLguList, setShowLguList] = useState(false);
  const provinceInputRef = useRef<HTMLInputElement>(null);
  const lguInputRef = useRef<HTMLInputElement>(null);
  /** Explicit selection from dropdown so Set limit works reliably */
  const [selectedProvinceForLimit, setSelectedProvinceForLimit] = useState<ProvinceWithLgus | null>(null);

  // Edit LGU limit modal (for configured limits list)
  const [editingLguLimit, setEditingLguLimit] = useState<{ psgcode: string; geolevel: string } | null>(null);
  const [editLguLimitValue, setEditLguLimitValue] = useState<string>('');
  const [lguLimitEditSaving, setLguLimitEditSaving] = useState(false);

  /** Sub-tab within Settings: Application | Bank & Contact | LGU Limits */
  const [settingsSubTab, setSettingsSubTab] = useState<'application' | 'bank-contact' | 'lgu-limits'>('application');

  // Fetch conferences and app config on mount
  useEffect(() => {
    fetchConferences();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      if (response.ok && data.config) {
        setAppConfig({
          REGISTRATION_LIMIT: data.config.REGISTRATION_LIMIT || '',
          DEFAULT_CONFERENCE: data.config.DEFAULT_CONFERENCE || '',
        });
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const openEditConferenceLimitModal = (conf: Conference) => {
    setEditingConferenceLimit(conf);
    setEditLimitValue(conf.reg_limit != null ? String(conf.reg_limit) : '');
  };

  const closeEditConferenceLimitModal = () => {
    setEditingConferenceLimit(null);
    setEditLimitValue('');
  };

  const handleSaveConferenceLimit = async () => {
    if (!editingConferenceLimit) return;
    const num = editLimitValue.trim() === '' ? null : Math.floor(Number(editLimitValue));
    if (editLimitValue.trim() !== '' && (!Number.isFinite(num) || 0 > num!)) {
      setError('Registration limit must be a non-negative whole number');
      return;
    }

    setConferenceLimitSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/conferences/${encodeURIComponent(editingConferenceLimit.confcode)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reg_limit: num }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('Conference limit updated successfully');
        closeEditConferenceLimitModal();
        fetchConferences();
      } else {
        setError(data.error || 'Failed to update conference limit');
      }
    } catch (err) {
      console.error('Error saving conference limit:', err);
      setError('An error occurred while updating conference limit');
    } finally {
      setConferenceLimitSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          REGISTRATION_LIMIT: appConfig.REGISTRATION_LIMIT || null,
          DEFAULT_CONFERENCE: appConfig.DEFAULT_CONFERENCE || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('Application settings saved successfully');
      } else {
        setError(data.error || 'Failed to save application settings');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      setError('An error occurred while saving application settings');
    } finally {
      setConfigSaving(false);
    }
  };

  // Fetch banks, contacts, and LGU data when conference changes
  useEffect(() => {
    if (selectedConference) {
      fetchBanks();
      fetchContacts();
      fetchLguLimitsData();
    } else {
      setBanks([]);
      setContacts([]);
      setLguProvinces([]);
      setLguLimitOverrides({});
    }
  }, [selectedConference]);

  // Clear LGU limit form when conference changes
  useEffect(() => {
    if (!selectedConference) {
      setProvinceSearch('');
      setLguSearch('');
      setSelectedProvinceForLimit(null);
      setSelectedLguForLimit(null);
      setLguFormUnlimited(true);
      setLguFormLimitValue(0);
    }
  }, [selectedConference]);

  const fetchLguLimitsData = async () => {
    if (!selectedConference) return;
    setLguLimitsLoading(true);
    try {
      const [lgusRes, limitsRes] = await Promise.all([
        fetch(`/api/conferences/${encodeURIComponent(selectedConference)}/lgus`),
        fetch(`/api/lgu-count-limits?confcode=${encodeURIComponent(selectedConference)}`),
      ]);
      const lgusData = await lgusRes.json();
      const limitsData = await limitsRes.json();

      if (lgusRes.ok && lgusData.provinces) {
        setLguProvinces(lgusData.provinces);
      } else {
        setLguProvinces([]);
      }

      const limitsList: LguLimitEntry[] = limitsRes.ok ? limitsData.limits || [] : [];
      const overrides: Record<string, LguLimitOverride> = {};
      for (const row of limitsList) {
        if (!row.psgcode || row.reg_limit == null) continue;
        overrides[row.psgcode] = {
          unlimited: false,
          value: row.reg_limit,
          geolevel: row.geolevel || 'MUN',
        };
      }
      setLguLimitOverrides(overrides);
    } catch (err) {
      console.error('Error fetching LGU limits data:', err);
      setLguProvinces([]);
      setLguLimitOverrides({});
    } finally {
      setLguLimitsLoading(false);
    }
  };

  const setLguLimitOverride = (psgcode: string, update: Partial<LguLimitOverride>, geolevel?: string) => {
    setLguLimitOverrides((prev) => {
      const cur = prev[psgcode] ?? { unlimited: true, value: 0, geolevel: geolevel || 'MUN' };
      const next = { ...cur, ...update };
      if (update.geolevel !== undefined) next.geolevel = update.geolevel;
      else if (geolevel !== undefined) next.geolevel = geolevel;
      return { ...prev, [psgcode]: next };
    });
  };

  const handleSaveLguLimits = async () => {
    if (!selectedConference) return;
    setLguLimitsSaving(true);
    setError('');
    setSuccess('');
    try {
      const limits: Array<{ psgcode: string; geolevel: string | null; reg_limit: number | null }> = [];
      for (const [psgcode, ov] of Object.entries(lguLimitOverrides)) {
        if (ov.unlimited) continue;
        const num = Math.floor(Number(ov.value));
        if (!Number.isFinite(num) || num < 0) continue;
        limits.push({
          psgcode,
          geolevel: ov.geolevel || null,
          reg_limit: num,
        });
      }
      const response = await fetch('/api/lgu-count-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confcode: selectedConference, limits }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('LGU limits saved successfully');
        fetchLguLimitsData();
      } else {
        setError(data.error || 'Failed to save LGU limits');
      }
    } catch (err) {
      console.error('Error saving LGU limits:', err);
      setError('An error occurred while saving LGU limits');
    } finally {
      setLguLimitsSaving(false);
    }
  };

  /** Resolve display label for a configured limit (psgcode + geolevel) */
  const getLimitDisplayLabel = (psgcode: string, geolevel: string): string => {
    if (geolevel === 'PROV') {
      const prov = lguProvinces.find((p) => p.psgc === psgcode);
      return prov ? `Province: ${prov.name}` : `Province (${psgcode})`;
    }
    for (const prov of lguProvinces) {
      const lgu = prov.lgus.find((l) => l.psgc === psgcode);
      if (lgu) return `LGU: ${lgu.lguname || psgcode} (${prov.name})`;
    }
    return psgcode;
  };

  /** Build limits array from overrides and PUT */
  const saveLguLimitsFromOverrides = async (overrides: Record<string, LguLimitOverride>) => {
    if (!selectedConference) return;
    setLguLimitsSaving(true);
    setError('');
    setSuccess('');
    try {
      const limits: Array<{ psgcode: string; geolevel: string | null; reg_limit: number | null }> = [];
      for (const [psgcode, ov] of Object.entries(overrides)) {
        if (ov.unlimited) continue;
        const num = Math.floor(Number(ov.value));
        if (!Number.isFinite(num) || num < 0) continue;
        limits.push({
          psgcode,
          geolevel: ov.geolevel || null,
          reg_limit: num,
        });
      }
      const response = await fetch('/api/lgu-count-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confcode: selectedConference, limits }),
      });
      const data = await response.json();
      if (response.ok) {
        setSuccess('LGU limits saved successfully');
        fetchLguLimitsData();
      } else {
        setError(data.error || 'Failed to save LGU limits');
      }
    } catch (err) {
      console.error('Error saving LGU limits:', err);
      setError('An error occurred while saving LGU limits');
    } finally {
      setLguLimitsSaving(false);
    }
  };

  const handleSetProvinceLimit = async (prov: ProvinceWithLgus) => {
    if (lguFormUnlimited) return;
    const num = Math.floor(Number(lguFormLimitValue));
    if (!Number.isFinite(num) || num < 0) return;
    const nextOverrides: Record<string, LguLimitOverride> = {
      ...lguLimitOverrides,
      [prov.psgc]: { unlimited: false, value: num, geolevel: 'PROV' },
    };
    setProvinceSearch('');
    setSelectedProvinceForLimit(null);
    setLguFormLimitValue(0);
    setLguFormUnlimited(true);
    await saveLguLimitsFromOverrides(nextOverrides);
  };

  const handleSetLguLimit = async (lgu: LguItem & { provinceName?: string }) => {
    if (lguFormUnlimited) return;
    const num = Math.floor(Number(lguFormLimitValue));
    if (!Number.isFinite(num) || num < 0) return;
    const nextOverrides: Record<string, LguLimitOverride> = {
      ...lguLimitOverrides,
      [lgu.psgc]: { unlimited: false, value: num, geolevel: lgu.geolevel || 'MUN' },
    };
    setLguSearch('');
    setSelectedLguForLimit(null);
    setLguFormLimitValue(0);
    setLguFormUnlimited(true);
    await saveLguLimitsFromOverrides(nextOverrides);
  };

  /** Resolve province for Set limit from selection or search text (case-insensitive, exact or single match) */
  const resolveProvinceForLimit = (): ProvinceWithLgus | null =>
    selectedProvinceForLimit ||
    (provinceSearch.trim()
      ? filteredProvinces.find(
          (p) => p.name.trim().toLowerCase() === provinceSearch.trim().toLowerCase()
        ) ?? (filteredProvinces.length === 1 ? filteredProvinces[0] : null)
      : null);

  /** Resolve LGU for Set limit from selection or search text (case-insensitive, exact or single match) */
  const resolveLguForLimit = (): (LguItem & { provinceName: string }) | null =>
    selectedLguForLimit ||
    (lguSearch.trim()
      ? filteredLgus.find(
          (l) =>
            (l.lguname || l.psgc) === lguSearch.trim() ||
            (l.lguname || '').toLowerCase() === lguSearch.trim().toLowerCase() ||
            (l.psgc || '').toLowerCase() === lguSearch.trim().toLowerCase()
        ) ?? (filteredLgus.length === 1 ? filteredLgus[0] : null)
      : null);

  const handleRemoveLimit = async (psgcode: string) => {
    const next = { ...lguLimitOverrides };
    delete next[psgcode];
    await saveLguLimitsFromOverrides(next);
  };

  const openEditLguLimitModal = (psgcode: string, geolevel: string) => {
    const ov = lguLimitOverrides[psgcode];
    setEditingLguLimit({ psgcode, geolevel });
    setEditLguLimitValue(ov && !ov.unlimited ? String(ov.value) : '');
  };

  const closeEditLguLimitModal = () => {
    setEditingLguLimit(null);
    setEditLguLimitValue('');
  };

  const handleSaveLguLimitEdit = async () => {
    if (!editingLguLimit || !selectedConference) return;
    const num = editLguLimitValue.trim() === '' ? null : Math.floor(Number(editLguLimitValue));
    if (editLguLimitValue.trim() !== '' && (!Number.isFinite(num) || (num as number) < 0)) {
      setError('Limit must be a non-negative whole number');
      return;
    }

    setLguLimitEditSaving(true);
    setError('');
    setSuccess('');

    try {
      const next = { ...lguLimitOverrides };
      if (num == null) {
        delete next[editingLguLimit.psgcode];
      } else {
        next[editingLguLimit.psgcode] = {
          unlimited: false,
          value: num,
          geolevel: editingLguLimit.geolevel,
        };
      }
      await saveLguLimitsFromOverrides(next);
      closeEditLguLimitModal();
    } finally {
      setLguLimitEditSaving(false);
    }
  };

  /** Flat list of LGUs with province name for search */
  const allLgusWithProvince = lguProvinces.flatMap((prov) =>
    prov.lgus.map((lgu) => ({ ...lgu, provinceName: prov.name }))
  );
  const filteredProvinces = provinceSearch.trim()
    ? lguProvinces.filter((p) =>
        p.name.toLowerCase().includes(provinceSearch.trim().toLowerCase())
      )
    : lguProvinces;
  /** When a province is selected (e.g. HIGHLY URBANIZED CITY), only show LGUs from that province in the LGU dropdown */
  const lguListByProvince = (() => {
    const prov = resolveProvinceForLimit();
    if (prov) {
      return allLgusWithProvince.filter((l) => l.provinceName === prov.name);
    }
    return allLgusWithProvince;
  })();
  const filteredLgus = lguSearch.trim()
    ? lguListByProvince.filter(
        (l) =>
          (l.lguname || '').toLowerCase().includes(lguSearch.trim().toLowerCase()) ||
          l.psgc.includes(lguSearch.trim())
      )
    : lguListByProvince;
  const configuredLimitsList = Object.entries(lguLimitOverrides).filter(
    ([_, ov]) => !ov.unlimited
  );

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
        <p className="text-sm text-gray-500">Manage application settings, bank details, and contact information</p>
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

      {/* Settings sub-tabs */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setSettingsSubTab('application')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              settingsSubTab === 'application'
                ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Application
          </button>
          <button
            type="button"
            onClick={() => setSettingsSubTab('bank-contact')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              settingsSubTab === 'bank-contact'
                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Bank & Contact
          </button>
          <button
            type="button"
            onClick={() => setSettingsSubTab('lgu-limits')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              settingsSubTab === 'lgu-limits'
                ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            LGU Limits
          </button>
        </div>
      </div>

      {settingsSubTab === 'application' && (
      <>
      {/* Application Settings Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Application Settings</h3>
          </div>
        </div>

        <div className="p-6">
          {configLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="registration_limit" className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Limit
                  </label>
                  <input
                    type="number"
                    id="registration_limit"
                    min="0"
                    value={appConfig.REGISTRATION_LIMIT}
                    onChange={(e) => setAppConfig({ ...appConfig, REGISTRATION_LIMIT: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    placeholder="No limit"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum total registrations allowed</p>
                </div>
              </div>
              <div>
                <label htmlFor="default_conference" className="block text-sm font-medium text-gray-700 mb-1">
                  Default Conference
                </label>
                <select
                  id="default_conference"
                  value={appConfig.DEFAULT_CONFERENCE}
                  onChange={(e) => setAppConfig({ ...appConfig, DEFAULT_CONFERENCE: e.target.value })}
                  className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                >
                  <option value="">-- None --</option>
                  {conferences.map((conf) => (
                    <option key={conf.confcode} value={conf.confcode}>
                      {conf.confcode} - {conf.name || 'Unnamed'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Default conference for new registrations</p>
              </div>

              {/* Conference Limits Table */}
              <div className="border-t border-gray-200 pt-5">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Conference Registration Limits</h4>
                <p className="text-xs text-gray-500 mb-3">Per-conference registration limits. Leave empty for no limit.</p>
                {conferences.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No conferences found.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conference</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration Limit</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {conferences.map((conf) => (
                          <tr key={conf.confcode} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <span className="font-medium">{conf.confcode}</span>
                              {conf.name && <span className="text-gray-500 ml-1">– {conf.name}</span>}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="font-mono text-gray-700">
                                {conf.reg_limit != null ? conf.reg_limit.toLocaleString() : 'No limit'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => openEditConferenceLimitModal(conf)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-md transition-colors"
                                title="Edit conference limit"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {configSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {settingsSubTab === 'bank-contact' && (
      <>
      {/* Conference Selector - required for bank/contact */}
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
        <p className="text-xs text-gray-500 mt-1">Select a conference first to set LGU limits or manage bank/contact details.</p>
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
      </>
      )}

      {settingsSubTab === 'lgu-limits' && (
      <>
      {/* LGU Limits Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">LGU Limits</h3>
              <p className="text-sm text-white/90">Select a conference first, then set a limit per province or per specific LGU. Only LGUs assigned to that conference are available.</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-5">
            <label htmlFor="lgu-conference-select" className="block text-sm font-medium text-gray-700 mb-1">Conference</label>
            <select
              id="lgu-conference-select"
              value={selectedConference}
              onChange={(e) => setSelectedConference(e.target.value)}
              className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
            >
              <option value="">-- Select a conference --</option>
              {conferences.map((conf) => (
                <option key={conf.confcode} value={conf.confcode}>
                  {conf.confcode} - {conf.name || 'Unnamed'}
                </option>
              ))}
            </select>
          </div>

          {!selectedConference ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Select a conference above to configure LGU limits.</p>
            </div>
          ) : lguLimitsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
            </div>
          ) : lguProvinces.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No provinces/LGUs found for this conference. Check conference PSGC / include_psgc / exclude_psgc.</p>
            </div>
          ) : (
            <>
                <div className="mb-4 pb-3 border-b border-gray-200">
                  <p className="text-xs text-gray-500">Only provinces and LGUs assigned to this conference are shown below.</p>
                </div>
                <div className="space-y-6">
                  {/* Set Province limit (applies to entire province) */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Set limit for a Province</h4>
                    <p className="text-xs text-gray-600 mb-3">This limit applies to the whole province (all cities/municipalities under it). Select a province from the list, uncheck Unlimited, enter a number, then click Set limit.</p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[200px] relative">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Search Province</label>
                        <input
                          ref={provinceInputRef}
                          type="text"
                          value={provinceSearch}
                          onChange={(e) => {
                            setProvinceSearch(e.target.value);
                            setSelectedProvinceForLimit(null);
                            setShowProvinceList(true);
                          }}
                          onFocus={() => setShowProvinceList(true)}
                          onBlur={() => setTimeout(() => setShowProvinceList(false), 200)}
                          placeholder="Type to search province..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        />
                        {showProvinceList &&
                          filteredProvinces.length > 0 &&
                          typeof document !== 'undefined' &&
                          createPortal(
                            (() => {
                              const rect = provinceInputRef.current?.getBoundingClientRect();
                              if (!rect) return null;
                              return (
                                <ul
                                  className="fixed z-[100] mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
                                  style={{
                                    top: rect.bottom + 4,
                                    left: rect.left,
                                    width: Math.max(rect.width, 200),
                                  }}
                                >
                                  {filteredProvinces.slice(0, 50).map((prov) => (
                                    <li
                                      key={prov.psgc}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setProvinceSearch(prov.name);
                                        setSelectedProvinceForLimit(prov);
                                        setShowProvinceList(false);
                                        setLguFormLimitValue(lguLimitOverrides[prov.psgc]?.value ?? 0);
                                        setLguFormUnlimited(!!lguLimitOverrides[prov.psgc]?.unlimited);
                                      }}
                                      className="px-3 py-2 text-sm cursor-pointer hover:bg-amber-50 border-b border-gray-100 last:border-0"
                                    >
                                      {prov.name}
                                      {lguLimitOverrides[prov.psgc] && !lguLimitOverrides[prov.psgc].unlimited && (
                                        <span className="ml-2 text-amber-600">(limit: {lguLimitOverrides[prov.psgc].value})</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              );
                            })(),
                            document.body
                          )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lguFormUnlimited}
                            onChange={(e) => setLguFormUnlimited(e.target.checked)}
                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                          />
                          Unlimited
                        </label>
                      </div>
                      {!lguFormUnlimited && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Limit</label>
                          <input
                            type="number"
                            min={0}
                            value={lguFormLimitValue}
                            onChange={(e) => setLguFormLimitValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const prov = resolveProvinceForLimit();
                          if (prov && !lguFormUnlimited) handleSetProvinceLimit(prov);
                        }}
                        disabled={lguLimitsSaving || lguFormUnlimited || !resolveProvinceForLimit()}
                        className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Set limit
                      </button>
                    </div>
                  </div>

                  {/* Set LGU limit (specific city/municipality) */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Set limit for a specific LGU</h4>
                    <p className="text-xs text-gray-600 mb-3">Limit applies only to that city or municipality. Select an LGU from the list, uncheck Unlimited, enter a number, then click Set limit.</p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[200px] relative">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Search LGU (name or PSGC)</label>
                        <input
                          ref={lguInputRef}
                          type="text"
                          value={lguSearch}
                          onChange={(e) => {
                            setLguSearch(e.target.value);
                            setSelectedLguForLimit(null);
                            setShowLguList(true);
                          }}
                          onFocus={() => setShowLguList(true)}
                          onBlur={() => setTimeout(() => setShowLguList(false), 200)}
                          placeholder="Type to search LGU..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        />
                        {showLguList &&
                          filteredLgus.length > 0 &&
                          typeof document !== 'undefined' &&
                          createPortal(
                            (() => {
                              const rect = lguInputRef.current?.getBoundingClientRect();
                              if (!rect) return null;
                              return (
                                <ul
                                  className="fixed z-[100] mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
                                  style={{
                                    top: rect.bottom + 4,
                                    left: rect.left,
                                    width: Math.max(rect.width, 200),
                                  }}
                                >
                                  {filteredLgus.slice(0, 50).map((l) => (
                                    <li
                                      key={l.psgc}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        setLguSearch(l.lguname || l.psgc);
                                        setSelectedLguForLimit({ ...l, provinceName: l.provinceName });
                                        setShowLguList(false);
                                        setLguFormLimitValue(lguLimitOverrides[l.psgc]?.value ?? 0);
                                        setLguFormUnlimited(!!lguLimitOverrides[l.psgc]?.unlimited);
                                      }}
                                      className="px-3 py-2 text-sm cursor-pointer hover:bg-amber-50 border-b border-gray-100 last:border-0"
                                    >
                                      {l.lguname || l.psgc} <span className="text-gray-500">({l.provinceName})</span>{' '}
                                      <span className="text-gray-400 font-medium">({l.geolevel || '—'})</span>
                                      {lguLimitOverrides[l.psgc] && !lguLimitOverrides[l.psgc].unlimited && (
                                        <span className="ml-2 text-amber-600">(limit: {lguLimitOverrides[l.psgc].value})</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              );
                            })(),
                            document.body
                          )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lguFormUnlimited}
                            onChange={(e) => setLguFormUnlimited(e.target.checked)}
                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                          />
                          Unlimited
                        </label>
                      </div>
                      {!lguFormUnlimited && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Limit</label>
                          <input
                            type="number"
                            min={0}
                            value={lguFormLimitValue}
                            onChange={(e) => setLguFormLimitValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const match = resolveLguForLimit();
                          if (match && !lguFormUnlimited) handleSetLguLimit(match);
                        }}
                        disabled={lguLimitsSaving || lguFormUnlimited || !resolveLguForLimit()}
                        className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Set limit
                      </button>
                    </div>
                  </div>

                  {/* Configured limits list */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Configured limits</h4>
                    {configuredLimitsList.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">No limits set. Add a province or LGU limit above.</p>
                    ) : (
                      <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                        {configuredLimitsList.map(([psgcode, ov]) => (
                          <li
                            key={psgcode}
                            className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50"
                          >
                            <div>
                              <span className="font-medium text-gray-900">{getLimitDisplayLabel(psgcode, ov.geolevel)}</span>
                              <span className="ml-2 text-sm text-gray-500">({ov.geolevel})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono text-amber-700">Limit: {ov.value}</span>
                              <button
                                type="button"
                                onClick={() => openEditLguLimitModal(psgcode, ov.geolevel)}
                                disabled={lguLimitsSaving}
                                className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-50"
                                title="Edit limit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveLimit(psgcode)}
                                disabled={lguLimitsSaving}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                title="Remove limit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
            </>
          )}
        </div>
      </div>
      </>
      )}

      {settingsSubTab === 'bank-contact' && !selectedConference && conferences.length > 0 && (
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

      {/* Edit Conference Limit Modal */}
      {editingConferenceLimit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Conference Limit</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {editingConferenceLimit.confcode} – {editingConferenceLimit.name || 'Unnamed'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="edit_reg_limit" className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Limit
                </label>
                <input
                  type="number"
                  id="edit_reg_limit"
                  min={0}
                  value={editLimitValue}
                  onChange={(e) => setEditLimitValue(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  placeholder="No limit (leave empty)"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum registrations for this conference. Leave empty for no limit.</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditConferenceLimitModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConferenceLimit}
                  disabled={conferenceLimitSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {conferenceLimitSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit LGU Limit Modal */}
      {editingLguLimit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit LGU Limit</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {getLimitDisplayLabel(editingLguLimit.psgcode, editingLguLimit.geolevel)}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="edit_lgu_limit" className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Limit
                </label>
                <input
                  type="number"
                  id="edit_lgu_limit"
                  min={0}
                  value={editLguLimitValue}
                  onChange={(e) => setEditLguLimitValue(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Enter limit"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum registrations for this province/LGU. Leave empty to remove limit.</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditLguLimitModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLguLimitEdit}
                  disabled={lguLimitEditSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {lguLimitEditSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
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
