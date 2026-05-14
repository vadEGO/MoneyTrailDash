import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          dim:     '#f8f8f8',
        },
        border: {
          DEFAULT: '#e5e5e5',
          strong:  '#d1d1d1',
        },
        ink: {
          DEFAULT: '#1a1c1c',
          2:       '#4c4546',
          3:       '#7e7576',
        },
        status: {
          red:    '#e02424',
          amber:  '#d97706',
          green:  '#059669',
          blue:   '#2563eb',
          purple: '#7c3aed',
        },
      },
      borderRadius: {
        DEFAULT: '4px',
        sm:  '2px',
        md:  '6px',
        lg:  '8px',
        xl:  '12px',
        full:'9999px',
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1' }],
        xs:    ['12px', { lineHeight: '1.4' }],
        sm:    ['13px', { lineHeight: '1.5' }],
        base:  ['14px', { lineHeight: '1.5' }],
        md:    ['16px', { lineHeight: '1.5' }],
        lg:    ['18px', { lineHeight: '1.4' }],
        xl:    ['24px', { lineHeight: '1.2' }],
        '2xl': ['32px', { lineHeight: '1.2' }],
      },
      spacing: {
        px:   '1px',
        0.5:  '2px',
        1:    '4px',
        2:    '8px',
        3:    '12px',
        4:    '16px',
        5:    '20px',
        6:    '24px',
        8:    '32px',
        10:   '40px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
export default config
