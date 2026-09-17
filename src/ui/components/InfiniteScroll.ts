import { Icons } from './Icons.ts';

export interface InfiniteScrollConfig<T> {
  targetElement: HTMLElement;
  items: T[];
  pageSize?: number;
  renderItem: (item: T, globalIndex: number) => string;
  sentinel?: HTMLElement | null;
  statusElement?: HTMLElement | null;
  statusFormatter?: (rendered: number, total: number) => string;
  onPageLoaded?: (renderedCount: number, totalCount: number) => void;
}

export class InfiniteScroll<T> {
  private targetElement: HTMLElement;
  private items: T[];
  private pageSize: number;
  private renderItem: (item: T, globalIndex: number) => string;
  private sentinel: HTMLElement | null = null;
  private statusElement: HTMLElement | null = null;
  private statusFormatter?: (rendered: number, total: number) => string;
  private onPageLoaded?: (renderedCount: number, totalCount: number) => void;

  private currentIndex = 0;
  private observer: IntersectionObserver | null = null;
  private isLoading = false;

  constructor(config: InfiniteScrollConfig<T>) {
    this.targetElement = config.targetElement;
    this.items = config.items || [];
    this.pageSize = config.pageSize || 30;
    this.renderItem = config.renderItem;
    this.sentinel = config.sentinel || null;
    this.statusElement = config.statusElement || null;
    this.statusFormatter = config.statusFormatter;
    this.onPageLoaded = config.onPageLoaded;

    this.init();
  }

  static generateSentinelHtml(
    id = 'infinite-scroll-sentinel',
    text = 'Carregando mais...',
  ): string {
    return `
      <div id="${id}" class="infinite-scroll-sentinel" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; color: var(--text-muted); font-size: 13px;">
        <span class="spin-animation" style="color: var(--primary); display: flex;">${Icons.refresh(14)}</span>
        <span>${text}</span>
      </div>
    `;
  }

  private init(): void {
    this.currentIndex = 0;
    this.targetElement.innerHTML = '';
    this.loadNextBatch();

    if (this.sentinel && typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !this.isLoading && this.currentIndex < this.items.length) {
              this.loadNextBatch();
            }
          }
        },
        { rootMargin: '250px' },
      );
      this.observer.observe(this.sentinel);
    }
  }

  loadNextBatch(): void {
    if (this.currentIndex >= this.items.length) {
      if (this.sentinel) {
        this.sentinel.style.display = 'none';
      }
      this.observer?.disconnect();
      return;
    }

    this.isLoading = true;
    const nextBatch = this.items.slice(this.currentIndex, this.currentIndex + this.pageSize);
    const htmlChunks = nextBatch
      .map((item, idx) => this.renderItem(item, this.currentIndex + idx))
      .join('');

    this.targetElement.insertAdjacentHTML('beforeend', htmlChunks);
    this.currentIndex += nextBatch.length;

    if (this.statusElement) {
      this.statusElement.innerHTML = this.statusFormatter
        ? this.statusFormatter(this.currentIndex, this.items.length)
        : `Mostrando ${this.currentIndex} de ${this.items.length}`;
    }

    if (this.currentIndex >= this.items.length) {
      if (this.sentinel) {
        this.sentinel.style.display = 'none';
      }
      this.observer?.disconnect();
    } else if (this.sentinel) {
      this.sentinel.style.display = 'flex';
    }

    this.isLoading = false;
    this.onPageLoaded?.(this.currentIndex, this.items.length);
  }

  getRenderedCount(): number {
    return this.currentIndex;
  }

  getTotalCount(): number {
    return this.items.length;
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
