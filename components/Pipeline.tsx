'use client';

import type { PipelineStep } from '@/lib/types';

/**
 * The numbering here is load-bearing: these five things happen in order, and
 * when something fails the operator needs to know which link broke.
 */
export function Pipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <section className="rounded-panel bg-card p-5 shadow-panel">
      <h2 className="text-sm font-semibold text-ink">Pipeline</h2>
      <ol className="mt-3">
        {steps.map((step, i) => (
          <li key={step.id} className="flex gap-3 py-2">
            <Marker state={step.state} index={i + 1} />
            <div className="min-w-0 flex-1">
              <p
                className={`text-[13px] leading-snug ${
                  step.state === 'pending' ? 'text-muted' : 'text-ink'
                }`}
              >
                {step.label}
              </p>
              {step.detail && (
                <p
                  className={`mt-0.5 text-micro leading-snug ${
                    step.state === 'failed' ? 'text-alert' : 'text-muted'
                  }`}
                >
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Marker({ state, index }: { state: PipelineStep['state']; index: number }) {
  const shell =
    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium';

  if (state === 'done')
    return (
      <span className={`${shell} bg-signal text-white`} aria-label="Done">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
          <path d="M2.5 6.3 4.8 8.6 9.5 3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );

  if (state === 'running')
    return (
      <span className={`${shell} bg-signal-wash text-signal`} aria-label="Running">
        <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
      </span>
    );

  if (state === 'failed')
    return (
      <span className={`${shell} bg-alert text-white`} aria-label="Failed">
        !
      </span>
    );

  if (state === 'skipped')
    return (
      <span className={`${shell} border border-dashed border-rule text-muted`} aria-label="Skipped">
        –
      </span>
    );

  return (
    <span className={`${shell} border border-rule text-muted`} aria-hidden>
      {index}
    </span>
  );
}
