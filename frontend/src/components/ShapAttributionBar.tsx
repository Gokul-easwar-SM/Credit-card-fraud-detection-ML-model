import React from 'react';
import type { TopDriver } from '../types';

interface ShapAttributionBarProps {
  drivers: TopDriver[];
}

export const ShapAttributionBar: React.FC<ShapAttributionBarProps> = ({ drivers }) => {
  if (!drivers || drivers.length === 0) {
    return <div className="text-xs text-slate-grey italic">No local feature attributions available.</div>;
  }

  const maxAbs = Math.max(...drivers.map((d) => Math.abs(d.shap_attribution)), 0.01);

  return (
    <div className="space-y-2.5">
      {drivers.map((driver, idx) => {
        const isFraudDriver = driver.shap_attribution > 0;
        const pct = Math.min(100, Math.round((Math.abs(driver.shap_attribution) / maxAbs) * 100));

        return (
          <div
            key={idx}
            className="bg-deep-aubergine-card border border-deep-aubergine-border rounded-lg p-3 transition-colors hover:border-muted-lavender/40"
          >
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-mono font-medium text-ice-silver tracking-tight">
                {driver.feature.replace(/_/g, ' ')}
              </span>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                  isFraudDriver
                    ? 'bg-red-950/60 text-red-300 border border-red-800/40'
                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                }`}
              >
                {isFraudDriver ? '+ Risk Multiplier' : '- Risk Stabilizer'} ({driver.shap_attribution > 0 ? '+' : ''}
                {driver.shap_attribution.toFixed(3)})
              </span>
            </div>

            {/* Subdued Bar */}
            <div className="w-full h-1.5 bg-deep-aubergine-dark rounded-full overflow-hidden mb-1.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFraudDriver ? 'bg-marigold' : 'bg-muted-lavender'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="text-[11px] text-soft-silver leading-relaxed">
              {driver.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};
