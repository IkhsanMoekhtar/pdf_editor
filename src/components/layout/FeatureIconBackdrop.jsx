import React from 'react';
import {
  ArrowUpDown,
  FileImage,
  FileSpreadsheet,
  FileText,
  Files,
  Presentation,
  Scissors,
  Type,
} from 'lucide-react';

const FEATURE_LAYOUTS = {
  merge: [
    { Icon: Files, x: '12%', y: '16%', size: 34, rotate: -10 },
    { Icon: FileText, x: '82%', y: '20%', size: 32, rotate: 9 },
    { Icon: Files, x: '18%', y: '78%', size: 36, rotate: 8 },
    { Icon: ArrowUpDown, x: '88%', y: '72%', size: 30, rotate: -12 },
    { Icon: Scissors, x: '56%', y: '18%', size: 30, rotate: 6 },
    { Icon: FileText, x: '62%', y: '82%', size: 28, rotate: -7 },
  ],
  split: [
    { Icon: Scissors, x: '14%', y: '18%', size: 34, rotate: -12 },
    { Icon: FileText, x: '84%', y: '18%', size: 32, rotate: 9 },
    { Icon: ArrowUpDown, x: '50%', y: '22%', size: 30, rotate: 5 },
    { Icon: FileText, x: '18%', y: '76%', size: 28, rotate: 7 },
    { Icon: Scissors, x: '82%', y: '76%', size: 36, rotate: -8 },
    { Icon: Files, x: '52%', y: '82%', size: 28, rotate: 10 },
  ],
  compress: [
    { Icon: FileText, x: '12%', y: '17%', size: 32, rotate: -9 },
    { Icon: ArrowUpDown, x: '84%', y: '18%', size: 34, rotate: 10 },
    { Icon: FileText, x: '18%', y: '82%', size: 28, rotate: 7 },
    { Icon: FileText, x: '82%', y: '80%', size: 30, rotate: -6 },
    { Icon: ArrowUpDown, x: '50%', y: '24%', size: 28, rotate: -8 },
    { Icon: Files, x: '50%', y: '78%', size: 36, rotate: 5 },
  ],
  convert: [
    { Icon: FileImage, x: '12%', y: '17%', size: 32, rotate: -8 },
    { Icon: FileSpreadsheet, x: '84%', y: '17%', size: 36, rotate: 9 },
    { Icon: Presentation, x: '88%', y: '48%', size: 34, rotate: -11 },
    { Icon: Type, x: '14%', y: '50%', size: 30, rotate: 6 },
    { Icon: FileText, x: '18%', y: '82%', size: 32, rotate: -5 },
    { Icon: ArrowUpDown, x: '81%', y: '82%', size: 34, rotate: 12 },
  ],
};

export default function FeatureIconBackdrop({ mode }) {
  const variant = FEATURE_LAYOUTS[mode] ? mode : 'convert';
  const icons = FEATURE_LAYOUTS[variant];

  return (
    <div className={`feature-backdrop feature-backdrop-${variant}`} aria-hidden="true">
      {icons.map(({ Icon, x, y, size, rotate }, index) => (
        <span
          key={`${variant}-${index}`}
          className="feature-bg-icon"
          style={{
            left: x,
            top: y,
            '--feature-icon-rotate': `${rotate}deg`,
            '--feature-icon-delay': `${index * 0.3}s`,
            '--feature-icon-speed': `${7.4 + (index % 3) * 1.25}s`,
          }}
        >
          <Icon size={size} strokeWidth={1.9} />
        </span>
      ))}
    </div>
  );
}
