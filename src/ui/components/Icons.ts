/**
 * Modern, elegant SVG icons library (Lucide-style).
 * Clean vector line icons with viewBox="0 0 24 24", stroke="currentColor", strokeWidth="2".
 */

export type IconName =
  | 'wallet'
  | 'fileText'
  | 'calculator'
  | 'fileSpreadsheet'
  | 'database'
  | 'trendingUp'
  | 'trendingDown'
  | 'upload'
  | 'download'
  | 'undo'
  | 'folderOpen'
  | 'trash'
  | 'shield'
  | 'shieldCheck'
  | 'coins'
  | 'dollarSign'
  | 'building'
  | 'refresh'
  | 'star'
  | 'arrowUpRight'
  | 'arrowDownRight'
  | 'search'
  | 'calendar'
  | 'tag'
  | 'copy'
  | 'check'
  | 'barChart'
  | 'landmark'
  | 'alertCircle'
  | 'info'
  | 'chevronDown'
  | 'chevronRight'
  | 'target'
  | 'zap'
  | 'gitMerge'
  | 'plusCircle'
  | 'layers';

export class Icons {
  /**
   * Helper to wrap inner SVG path content in a standardized SVG tag.
   */
  private static wrap(content: string, size: number = 18, className: string = ''): string {
    const cls = `svg-icon ${className}`.trim();
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${content}</svg>`;
  }

  static wallet(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>`,
      size,
      className,
    );
  }

  static fileText(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
      size,
      className,
    );
  }

  static calculator(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>`,
      size,
      className,
    );
  }

  static fileSpreadsheet(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>`,
      size,
      className,
    );
  }

  static database(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>`,
      size,
      className,
    );
  }

  static trendingUp(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
      size,
      className,
    );
  }

  static trendingDown(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>`,
      size,
      className,
    );
  }

  static upload(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`,
      size,
      className,
    );
  }

  static download(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
      size,
      className,
    );
  }

  static undo(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>`,
      size,
      className,
    );
  }

  static folderOpen(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>`,
      size,
      className,
    );
  }

  static trash(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>`,
      size,
      className,
    );
  }

  static shield(size: number = 18, className: string = ''): string {
    return this.wrap(`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`, size, className);
  }

  static shieldCheck(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>`,
      size,
      className,
    );
  }

  static coins(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>`,
      size,
      className,
    );
  }

  static dollarSign(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
      size,
      className,
    );
  }

  static building(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>`,
      size,
      className,
    );
  }

  static refresh(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8"/><path d="M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16"/>`,
      size,
      className,
    );
  }

  static star(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
      size,
      className,
    );
  }

  static arrowUpRight(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>`,
      size,
      className,
    );
  }

  static arrowDownRight(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/>`,
      size,
      className,
    );
  }

  static search(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
      size,
      className,
    );
  }

  static calendar(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
      size,
      className,
    );
  }

  static tag(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/>`,
      size,
      className,
    );
  }

  static copy(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
      size,
      className,
    );
  }

  static check(size: number = 18, className: string = ''): string {
    return this.wrap(`<polyline points="20 6 9 17 4 12"/>`, size, className);
  }

  static barChart(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>`,
      size,
      className,
    );
  }

  static landmark(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<line x1="2" y1="22" x2="22" y2="22"/><line x1="18" y1="11" x2="18" y2="18"/><line x1="14" y1="11" x2="14" y2="18"/><line x1="10" y1="11" x2="10" y2="18"/><line x1="6" y1="11" x2="6" y2="18"/><polygon points="12 2 20 7 4 7"/>`,
      size,
      className,
    );
  }

  static alertCircle(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
      size,
      className,
    );
  }

  static info(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,
      size,
      className,
    );
  }

  static chevronDown(size: number = 18, className: string = ''): string {
    return this.wrap(`<polyline points="6 9 12 15 18 9"/>`, size, className);
  }

  static chevronRight(size: number = 18, className: string = ''): string {
    return this.wrap(`<polyline points="9 18 15 12 9 6"/>`, size, className);
  }

  static target(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
      size,
      className,
    );
  }

  static zap(size: number = 18, className: string = ''): string {
    return this.wrap(`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`, size, className);
  }

  static gitMerge(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>`,
      size,
      className,
    );
  }

  static plusCircle(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`,
      size,
      className,
    );
  }

  static layers(size: number = 18, className: string = ''): string {
    return this.wrap(
      `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`,
      size,
      className,
    );
  }
}
