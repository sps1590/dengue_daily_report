import type { Config } from 'tailwindcss';

/**
 * Palette notes
 * -------------
 * The brief asks for medical blue, slate and an alert red. These are picked to
 * sit next to a scanned government form without clashing with it: a desaturated
 * institutional blue rather than a screen-bright one, a red that reads as a
 * mortality column rather than an error toast, and an amber reserved for bed
 * occupancy, which is the one figure that implies operational pressure.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#10202F',
        paper: '#F6F7F9',
        card: '#FFFFFF',
        signal: { DEFAULT: '#1B5E9C', deep: '#134472', wash: '#EAF1F8' },
        muted: '#61798F',
        alert: { DEFAULT: '#B3302A', wash: '#FBEDEC' },
        amber: { DEFAULT: '#A9702A', wash: '#FBF3E7' },
        rule: '#D9E0E8',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        bangla: ['"Noto Serif Bengali"', '"Nirmala UI"', 'SolaimanLipi', 'serif'],
      },
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
      borderRadius: { sheet: '2px', panel: '6px' },
      boxShadow: {
        panel: '0 1px 2px rgba(16,32,47,0.06), 0 0 0 1px rgba(16,32,47,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
