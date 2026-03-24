'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';

export default function LoginPage() {
  const handleGoogleSignIn = () => {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/google`,
      response_type: 'code',
      scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      prompt: 'consent',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          {/* Logo/Branding */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Executive AI Pro
            </h1>
            <p className="text-gray-600 text-sm">
              AI-powered executive assistant for real estate professionals
            </p>
          </div>

          {/* Description */}
          <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="text-sm font-semibold text-blue-900 mb-2">
              What you can do:
            </h2>
            <ul className="text-xs text-blue-800 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">{String.fromCharCode(10003)}</span>
                <span>Get AI-powered daily briefings with priority actions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">{String.fromCharCode(10003)}</span>
                <span>Automatically triage and categorize your emails</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">{String.fromCharCode(10003)}</span>
                <span>Track leads, transactions, and deadlines</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">{String.fromCharCode(10003)}</span>
                <span>Manage multiple email accounts seamlessly</span>
              </li>
            </ul>
          </div>

          {/* Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3 mb-6"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* Create Account Link */}
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              First time here?{' '}
              <Link
                href="/onboarding"
                className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
              >
                Get started
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs text-gray-500 text-center mb-3">
              We&apos;ll never access your passwords. We use OAuth 2.0 to securely
              connect to your Gmail and Google Calendar.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
              <Link href="#" className="hover:text-gray-700 transition-colors">
                Privacy
              </Link>
              <span>&bull;</span>
              <Link href="#" className="hover:text-gray-700 transition-colors">
                Terms
              </Link>
              <span>&bull;</span>
              <Link href="#" className="hover:text-gray-700 transition-colors">
                Support
              </Link>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="mt-8 text-center">
          <p className="text-sm text-blue-100 italic">
            &quot;Executive AI Pro saved me 10 hours a week by automating my email
            triage and keeping me on top of deadlines.&quot;
          </p>
          <p className="text-xs text-blue-200 mt-2">&mdash; Real Estate Agent</p>
        </div>
      </div>
    </div>
  );
}
