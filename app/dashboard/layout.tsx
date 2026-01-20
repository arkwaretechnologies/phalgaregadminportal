'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { User } from '@/types';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen');
    if (savedState !== null) {
      setSidebarOpen(savedState === 'true');
    }
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen.toString());
  }, [sidebarOpen]);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Keep reports menu open if on reports page
  useEffect(() => {
    if (pathname?.startsWith('/dashboard/reports')) {
      setReportsMenuOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    // Fetch user info
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser({
            user_id: data.user.user_id,
            username: data.user.username,
            fullname: data.user.fullname,
            role: data.user.role,
            created_at: '',
            updated_at: '',
          });
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Use full page navigation to clear all cached state
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden" style={{ colorScheme: 'light' }}>
      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0 flex-1 px-3">
            <p className="text-sm font-semibold text-gray-900 truncate">PhALGA Admin</p>
            <p className="text-xs text-gray-500 truncate">{user.fullname || user.username}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-md p-2 text-red-700 hover:bg-red-50"
            aria-label="Logout"
            title="Logout"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-40 ${mobileDrawerOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileDrawerOpen}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity ${mobileDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileDrawerOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-gray-900 text-white shadow-2xl transform transition-transform ${
            mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-bold truncate">PhALGA Admin</h1>
                <p className="text-sm text-gray-400 mt-1 truncate">Registration Committee</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 hover:bg-gray-800 rounded-md transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-2">
              <Link
                href="/dashboard"
                className={`flex items-center px-3 py-3 rounded-lg transition-all duration-200 ${
                  pathname === '/dashboard'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="ml-3 font-medium">Registrations</span>
              </Link>
              <Link
                href="/dashboard/download-participants"
                className={`flex items-center px-3 py-3 rounded-lg transition-all duration-200 ${
                  pathname === '/dashboard/download-participants'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="ml-3 font-medium">Download Participant List</span>
              </Link>
              <div>
                <button
                  onClick={() => setReportsMenuOpen(!reportsMenuOpen)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all duration-200 ${
                    pathname?.startsWith('/dashboard/reports')
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="ml-3 font-medium">Reports</span>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${reportsMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {reportsMenuOpen && (
                  <div className="mt-1 ml-6 space-y-1">
                    <Link
                      href="/dashboard/reports/participants"
                      className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                        pathname === '/dashboard/reports/participants'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-sm">All Approved Participants</span>
                    </Link>
                    <Link
                      href="/dashboard/reports/rejected"
                      className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                        pathname === '/dashboard/reports/rejected'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-sm">All Rejected Registrations</span>
                    </Link>
                    <Link
                      href="/dashboard/reports/batches"
                      className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                        pathname === '/dashboard/reports/batches'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-sm">Per Batch Number</span>
                    </Link>
                    <Link
                      href="/dashboard/reports/tshirt-sizes"
                      className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                        pathname === '/dashboard/reports/tshirt-sizes'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-sm">T-Shirt Size Summary</span>
                    </Link>
                  </div>
                )}
              </div>
              {user.role === 'admin' && (
                <>
                  <Link
                    href="/dashboard/configuration"
                    className={`flex items-center px-3 py-3 rounded-lg transition-all duration-200 ${
                      pathname === '/dashboard/configuration'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="ml-3 font-medium">Configuration</span>
                  </Link>
                  <Link
                    href="/dashboard/users"
                    className={`flex items-center px-3 py-3 rounded-lg transition-all duration-200 ${
                      pathname === '/dashboard/users'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="ml-3 font-medium">User Management</span>
                  </Link>
                </>
              )}
            </nav>
            <div className="p-4 border-t border-gray-800">
              <div className="mb-4">
                <p className="text-sm font-medium">{user.fullname || user.username}</p>
                <p className="text-xs text-gray-400 capitalize">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 bg-gray-900 text-white transition-all duration-300 ease-in-out z-30 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              {sidebarOpen ? (
                <>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold truncate">PhALGA Admin</h1>
                    <p className="text-sm text-gray-400 mt-1 truncate">Registration Committee</p>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 hover:bg-gray-800 rounded-md transition-colors"
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="w-full flex justify-center">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 hover:bg-gray-800 rounded-md transition-colors"
                    aria-label="Expand sidebar"
                    title="Expand sidebar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link
              href="/dashboard"
              className={`flex items-center ${
                sidebarOpen ? 'px-4' : 'px-3 justify-center'
              } py-3 rounded-lg transition-all duration-200 group ${
                pathname === '/dashboard'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
              title="Registrations"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {sidebarOpen && (
                <span className="ml-3 font-medium transition-opacity duration-300">
                  Registrations
                </span>
              )}
            </Link>
            <Link
              href="/dashboard/download-participants"
              className={`flex items-center ${
                sidebarOpen ? 'px-4' : 'px-3 justify-center'
              } py-3 rounded-lg transition-all duration-200 group ${
                pathname === '/dashboard/download-participants'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
              title="Download Participant List"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {sidebarOpen && (
                <span className="ml-3 font-medium transition-opacity duration-300">
                  Download Participant List
                </span>
              )}
            </Link>
            <div>
              <button
                onClick={() => setReportsMenuOpen(!reportsMenuOpen)}
                className={`w-full flex items-center ${
                  sidebarOpen ? 'px-4' : 'px-3 justify-center'
                } py-3 rounded-lg transition-all duration-200 group ${
                  pathname?.startsWith('/dashboard/reports')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
                title="Reports"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {sidebarOpen && (
                  <>
                    <span className="ml-3 font-medium transition-opacity duration-300 flex-1 text-left">
                      Reports
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${reportsMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
              {sidebarOpen && reportsMenuOpen && (
                <div className="mt-1 ml-6 space-y-1">
                  <Link
                    href="/dashboard/reports/participants"
                    className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                      pathname === '/dashboard/reports/participants'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                    }`}
                    title="All Approved Participants"
                  >
                    <span className="text-sm">All Approved Participants</span>
                  </Link>
                  <Link
                    href="/dashboard/reports/rejected"
                    className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                      pathname === '/dashboard/reports/rejected'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                    }`}
                    title="All Rejected Registrations"
                  >
                    <span className="text-sm">All Rejected Registrations</span>
                  </Link>
                  <Link
                    href="/dashboard/reports/batches"
                    className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                      pathname === '/dashboard/reports/batches'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                    }`}
                    title="Per Batch Number"
                  >
                    <span className="text-sm">Per Batch Number</span>
                  </Link>
                  <Link
                    href="/dashboard/reports/tshirt-sizes"
                    className={`flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
                      pathname === '/dashboard/reports/tshirt-sizes'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                    }`}
                    title="T-Shirt Size Summary"
                  >
                    <span className="text-sm">T-Shirt Size Summary</span>
                  </Link>
                </div>
              )}
            </div>
            {user.role === 'admin' && (
              <>
                <Link
                  href="/dashboard/configuration"
                  className={`flex items-center ${
                    sidebarOpen ? 'px-4' : 'px-3 justify-center'
                  } py-3 rounded-lg transition-all duration-200 group ${
                    pathname === '/dashboard/configuration'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  title="Configuration"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {sidebarOpen && (
                    <span className="ml-3 font-medium transition-opacity duration-300">
                      Configuration
                    </span>
                  )}
                </Link>
                <Link
                  href="/dashboard/users"
                  className={`flex items-center ${
                    sidebarOpen ? 'px-4' : 'px-3 justify-center'
                  } py-3 rounded-lg transition-all duration-200 group ${
                    pathname === '/dashboard/users'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  title="User Management"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  {sidebarOpen && (
                    <span className="ml-3 font-medium transition-opacity duration-300">
                      User Management
                    </span>
                  )}
                </Link>
              </>
            )}
          </nav>
          <div className="p-4 border-t border-gray-800">
            <div
              className={`mb-4 transition-opacity duration-300 ${
                sidebarOpen ? 'opacity-100' : 'opacity-0 h-0 mb-0 overflow-hidden'
              }`}
            >
              <p className="text-sm font-medium">{user.fullname || user.username}</p>
              <p className="text-xs text-gray-400 capitalize">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className={`w-full ${
                sidebarOpen ? 'px-4' : 'px-3'
              } py-2 text-sm bg-red-600 hover:bg-red-700 rounded-lg transition-all duration-200 flex items-center justify-center gap-2`}
              title="Logout"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`flex flex-col transition-all duration-300 ease-in-out px-4 py-4 sm:px-6 sm:py-6 lg:p-8 pt-20 lg:pt-8 bg-gray-50 text-gray-900 min-h-screen ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
        }`}
      >
        <div className="flex-1">
          {children}
        </div>
        <footer className="mt-8 py-4 border-t border-gray-100 text-center">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
            {'\u00A9'} {new Date().getFullYear()} ARKWARE TECHNOLOGIES
          </p>
        </footer>
      </main>
    </div>
  );
}
