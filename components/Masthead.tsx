'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LABELS } from '@/lib/bijoy';
import { toBengaliLongDate, toEnglishLongDate } from '@/lib/bengali';

const NAV = [
  { href: '/', label: 'Report' },
  { href: '/dashboard', label: 'Dashboard' },
] as const;

/**
 * The page opens with the form itself. Anyone in this workflow recognises the
 * four-line Bangla masthead before they read a single figure, so it does the
 * job an abstract dashboard header could not.
 */
export function Masthead({ date }: { date: string | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule bg-card">
      <div className="mx-auto max-w-[1180px] px-6 py-7">
        <div className="font-bangla text-center leading-relaxed">
          <p className="text-[15px] font-semibold">{LABELS.govt.unicode}</p>
          <p className="text-[15px] font-semibold">{LABELS.dghs.unicode.trim()}</p>
          <p className="text-[14px]">{LABELS.branch.unicode}</p>
          <p className="text-[14px] text-muted">{LABELS.address.unicode}</p>
          <p className="mt-3 text-[17px] font-semibold">{LABELS.title.unicode}</p>
        </div>

        <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 border-t border-rule pt-4 text-sm text-muted">
          <span className="text-ink">
            {date ? toEnglishLongDate(date) : 'No date selected'}
          </span>
          {date && <span className="font-bangla text-[13px]">{toBengaliLongDate(date)}</span>}
        </div>

        <nav className="mt-4 flex justify-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-sheet px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active ? 'bg-signal text-white' : 'text-muted hover:bg-signal-wash hover:text-signal'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
