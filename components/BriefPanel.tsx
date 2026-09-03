'use client';

import type { ManagementBrief } from '@/lib/types';

interface Props {
  brief: ManagementBrief | null;
  busy: boolean;
  error: string | null;
  language: 'en' | 'bn';
  onLanguageChange: (v: 'en' | 'bn') => void;
  onAnalyse: () => void;
  onDownload: () => void;
}

export function BriefPanel({ brief, busy, error, language, onLanguageChange, onAnalyse, onDownload }: Props) {
  return (
    <section className="rounded-panel bg-card shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Management brief</h2>
          <p className="mt-0.5 text-micro text-muted">
            Reads the extracted figures and writes the interpretation, not a restatement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-sheet border border-rule p-0.5">
            {(['en', 'bn'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLanguageChange(code)}
                className={`rounded-[2px] px-2.5 py-1 text-micro ${
                  language === code ? 'bg-signal text-white' : 'text-muted hover:text-ink'
                } ${code === 'bn' ? 'font-bangla' : ''}`}
              >
                {code === 'en' ? 'English' : 'বাংলা'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onAnalyse}
            disabled={busy}
            className="rounded-sheet bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:bg-muted"
          >
            {busy ? 'Analysing…' : brief ? 'Regenerate' : 'Analyse data'}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {error && (
          <p className="rounded-sheet border border-alert/30 bg-alert-wash px-3 py-2 text-[13px] text-alert">
            {error}
          </p>
        )}

        {!brief && !error && !busy && (
          <p className="text-[13px] leading-relaxed text-muted">
            Nothing analysed yet. Run the analysis to get a situation read, the geographic pattern,
            risk flags and a short list of actions for this week.
          </p>
        )}

        {busy && !brief && (
          <div className="space-y-2" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 animate-pulse rounded-sheet bg-paper" style={{ width: `${88 - i * 14}%` }} />
            ))}
          </div>
        )}

        {brief && (
          <article className={`space-y-5 ${brief.language === 'bn' ? 'font-bangla' : ''}`}>
            <p className="text-[15px] font-semibold leading-snug">{brief.headline}</p>
            <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-ink/85">{brief.situation}</p>

            <Block title={brief.language === 'bn' ? 'মূল পর্যবেক্ষণ' : 'Key findings'}>
              <ul className="space-y-1.5">
                {brief.keyFindings.map((f, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal" />
                    <span className="max-w-[68ch]">{f}</span>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title={brief.language === 'bn' ? 'ভৌগোলিক চিত্র' : 'Geographic pattern'}>
              <p className="max-w-[70ch] text-[13.5px] leading-relaxed">{brief.geographicPattern}</p>
            </Block>

            {brief.riskFlags?.length > 0 && (
              <Block title={brief.language === 'bn' ? 'ঝুঁকি' : 'Risk flags'}>
                <ul className="space-y-2">
                  {brief.riskFlags.map((r, i) => (
                    <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                      <span
                        className={`mt-0.5 shrink-0 rounded-sheet px-1.5 py-0.5 text-micro ${
                          r.level === 'high'
                            ? 'bg-alert-wash text-alert'
                            : r.level === 'moderate'
                              ? 'bg-amber-wash text-amber'
                              : 'bg-signal-wash text-signal'
                        }`}
                      >
                        {r.level}
                      </span>
                      <span className="max-w-[64ch]">{r.text}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            <Block title={brief.language === 'bn' ? 'করণীয়' : 'Recommended actions'}>
              <ol className="space-y-1.5">
                {brief.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                    <span className="mt-[3px] w-4 shrink-0 text-micro text-muted">{i + 1}</span>
                    <span className="max-w-[66ch]">{r}</span>
                  </li>
                ))}
              </ol>
            </Block>

            {brief.dataCaveats?.length > 0 && (
              <Block title={brief.language === 'bn' ? 'তথ্যের সীমাবদ্ধতা' : 'What these numbers cannot tell you'}>
                <ul className="space-y-1.5">
                  {brief.dataCaveats.map((c, i) => (
                    <li key={i} className="max-w-[70ch] text-[13px] leading-relaxed text-muted">
                      {c}
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
              <button
                type="button"
                onClick={onDownload}
                className="rounded-sheet border border-rule px-3.5 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-signal hover:text-signal"
              >
                Save brief as HTML
              </button>
              <span className="text-micro text-muted">
                Drafted {new Date(brief.generatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })} Dhaka time.
                Check the figures before circulating.
              </span>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 border-b border-rule pb-1.5 text-[13px] font-semibold text-signal-deep">{title}</h3>
      {children}
    </div>
  );
}
