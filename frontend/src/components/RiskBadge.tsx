import React from 'react';
import { ShieldCheck, AlertCircle, ShieldAlert } from 'lucide-react';
import type { RiskBand } from '../types';

interface RiskBadgeProps {
  band: RiskBand | string;
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ band, score, size = 'md' }) => {
  const normBand = (band || 'low').toLowerCase();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  }[size];

  if (normBand === 'high') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded bg-red-950/60 text-red-300 border border-red-800/60 font-mono ${sizeClasses}`}
      >
        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
        <span>HIGH {score !== undefined && score !== null ? `${(score * 100).toFixed(1)}%` : ''}</span>
      </span>
    );
  }

  if (normBand === 'medium') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 font-mono ${sizeClasses}`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
        <span>MED {score !== undefined && score !== null ? `${(score * 100).toFixed(1)}%` : ''}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-mono ${sizeClasses}`}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
      <span>LOW {score !== undefined && score !== null ? `${(score * 100).toFixed(1)}%` : ''}</span>
    </span>
  );
};
