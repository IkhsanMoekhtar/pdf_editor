import React from 'react';
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  FoldHorizontal,
  Highlighter,
  PenTool,
  PencilLine,
  Presentation,
  Scissors,
  Type,
} from 'lucide-react';

const ICON_LAYOUTS = {
  editor: [
    { Icon: FileText, x: '14%', y: '18%', size: 26, rotate: -9 },
    { Icon: PenTool, x: '85%', y: '16%', size: 30, rotate: 11 },
    { Icon: Type, x: '88%', y: '46%', size: 24, rotate: -7 },
    { Icon: Highlighter, x: '11%', y: '58%', size: 28, rotate: 8 },
    { Icon: PencilLine, x: '82%', y: '78%', size: 30, rotate: -10 },
    { Icon: FoldHorizontal, x: '19%', y: '83%', size: 24, rotate: 7 },
  ],
  batch: [
    { Icon: FileText, x: '10%', y: '16%', size: 26, rotate: -8 },
    { Icon: FoldHorizontal, x: '84%', y: '18%', size: 30, rotate: 10 },
    { Icon: Scissors, x: '89%', y: '45%', size: 26, rotate: -14 },
    { Icon: PenTool, x: '13%', y: '50%', size: 24, rotate: 6 },
    { Icon: PencilLine, x: '17%', y: '82%', size: 28, rotate: -6 },
    { Icon: Highlighter, x: '82%', y: '82%', size: 28, rotate: 12 },
  ],
  convert: [
    { Icon: FileImage, x: '13%', y: '17%', size: 26, rotate: -8 },
    { Icon: FileSpreadsheet, x: '84%', y: '17%', size: 30, rotate: 9 },
    { Icon: Presentation, x: '88%', y: '47%', size: 28, rotate: -11 },
    { Icon: FileText, x: '14%', y: '50%', size: 25, rotate: 6 },
    { Icon: Type, x: '18%', y: '82%', size: 26, rotate: -5 },
    { Icon: PenTool, x: '81%', y: '82%', size: 28, rotate: 12 },
  ],
  empty: [
    { Icon: FileText, x: '12%', y: '18%', size: 26, rotate: -8 },
    { Icon: PenTool, x: '84%', y: '19%', size: 30, rotate: 10 },
    { Icon: PencilLine, x: '88%', y: '50%', size: 26, rotate: -9 },
    { Icon: Highlighter, x: '12%', y: '54%', size: 26, rotate: 8 },
    { Icon: Type, x: '20%', y: '82%', size: 25, rotate: -7 },
    { Icon: FoldHorizontal, x: '81%', y: '82%', size: 27, rotate: 9 },
  ],
};

export default function WorkspaceIconBackdrop({ mode = 'empty', theme = 'editorial' }) {
  const variant = ICON_LAYOUTS[mode] ? mode : 'empty';
  const icons = ICON_LAYOUTS[variant];

  return (
    <div className={`workspace-backdrop workspace-backdrop-${variant} workspace-theme-${theme}`} aria-hidden="true">
      {icons.map(({ Icon, x, y, size, rotate }, index) => (
        <span
          key={`${variant}-${index}`}
          className="workspace-bg-icon"
          style={{
            left: x,
            top: y,
            '--bg-icon-rotate': `${rotate}deg`,
            '--bg-icon-delay': `${index * 0.35}s`,
            '--bg-icon-speed': `${7.5 + (index % 3) * 1.4}s`,
          }}
        >
          <Icon size={size} strokeWidth={1.6} />
        </span>
      ))}
    </div>
  );
}
