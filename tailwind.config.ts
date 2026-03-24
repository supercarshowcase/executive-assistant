import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        'primary-50': '#eff6ff',
        'primary-100': '#dbeafe',
        'primary-200': '#bfdbfe',
        'primary-600': '#2563eb',
        'primary-700': '#1d4ed8',
        'primary-900': '#1e3a8a',
        accent: '#f59e0b',
        'accent-50': '#fffbeb',
        'accent-100': '#fef3c7',
        'accent-500': '#f59e0b',
        urgent: '#ef4444',
        'urgent-50': '#fef2f2',
        'urgent-100': '#fee2e2',
        'urgent-500': '#ef4444',
        lead: '#22c55e',
        'lead-50': '#f0fdf4',
        'lead-100': '#dcfce7',
        'lead-500': '#22c55e',
        transaction: '#a855f7',
        'transaction-50': '#faf5ff',
        'transaction-100': '#f3e8ff',
        'transaction-500': '#a855f7',
      },
      fontFamily: { sans: ['var(--font-inter)'] },
      spacing: { safe: 'max(1rem, env(safe-area-inset-bottom))' },
      borderRadius: { lg: '0.5rem', xl: '0.75rem' },
    },
  },
  plugins: [],
}

export default config
