'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<'username' | 'password' | null>(null);

  useEffect(() => {
    // Add entrance animation
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Client-side validation
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden" style={{ colorScheme: 'light' }}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main login card */}
      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in-up">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          {/* Logos inside the login box */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="relative w-20 h-20 opacity-90 hover:opacity-100 transition-opacity duration-300 animate-fade-in-left">
              <Image
                src="/left.png"
                alt="Left Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="relative w-20 h-20 opacity-90 hover:opacity-100 transition-opacity duration-300 animate-fade-in-right">
              <Image
                src="/right.png"
                alt="Right Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-2 animate-slide-down tracking-tight text-gray-900">
              <span className="text-indigo-600">PhALGA</span>
            </h2>
            <p className="text-gray-700 text-sm font-medium animate-slide-down animation-delay-100 mt-2">
              Registration Committee Portal
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Username field */}
              <div className="relative group">
                <label
                  htmlFor="username"
                  className={`absolute left-4 transition-all duration-300 pointer-events-none ${
                    focused === 'username' || username
                      ? 'top-2 text-xs text-indigo-600 font-medium'
                      : 'top-3.5 text-sm text-gray-400'
                  }`}
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  onFocus={() => setFocused('username')}
                  onBlur={() => setFocused(null)}
                  disabled={loading}
                  className="w-full px-4 pt-6 pb-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all duration-300 bg-white hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-medium"
                />
              </div>

              {/* Password field */}
              <div className="relative group">
                <label
                  htmlFor="password"
                  className={`absolute left-4 transition-all duration-300 pointer-events-none ${
                    focused === 'password' || password
                      ? 'top-2 text-xs text-indigo-600 font-medium'
                      : 'top-3.5 text-sm text-gray-400'
                  }`}
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  disabled={loading}
                  className="w-full px-4 pt-6 pb-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all duration-300 bg-white hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-medium"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 animate-shake">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-red-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex items-center justify-center py-3.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Logging in...
                </>
              ) : (
                <>
                  Sign in
                  <svg
                    className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}