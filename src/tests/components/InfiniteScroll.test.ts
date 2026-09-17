import { describe, it, expect } from 'bun:test';
import { InfiniteScroll } from '../../ui/components/InfiniteScroll.ts';

describe('InfiniteScroll Component', () => {
  it('should generate valid sentinel HTML markup', () => {
    const html = InfiniteScroll.generateSentinelHtml('test-sentinel', 'Carregando testes...');
    expect(html).toContain('id="test-sentinel"');
    expect(html).toContain('Carregando testes...');
    expect(html).toContain('spin-animation');
  });

  it('should render initial batch and increment count on loadNextBatch', () => {
    const container = {
      innerHTML: '',
      insertAdjacentHTML(_position: string, html: string) {
        container.innerHTML += html;
      },
      querySelectorAll(selector: string) {
        if (selector === '.item') {
          const matches = container.innerHTML.match(/class="item"/g);
          return matches || [];
        }
        return [];
      },
    } as unknown as HTMLElement;

    const statusEl = {
      innerHTML: '',
      get textContent() {
        return statusEl.innerHTML;
      },
    } as unknown as HTMLElement;

    const mockItems = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `Item ${i + 1}`,
    }));

    const scroll = new InfiniteScroll({
      targetElement: container,
      items: mockItems,
      pageSize: 30,
      statusElement: statusEl,
      renderItem: (item) => `<div class="item">${item.name}</div>`,
    });

    expect(scroll.getTotalCount()).toBe(100);
    expect(scroll.getRenderedCount()).toBe(30);
    expect(container.querySelectorAll('.item').length).toBe(30);
    expect(statusEl.textContent).toContain('30');

    // Load second batch
    scroll.loadNextBatch();
    expect(scroll.getRenderedCount()).toBe(60);
    expect(container.querySelectorAll('.item').length).toBe(60);

    // Load third batch
    scroll.loadNextBatch();
    expect(scroll.getRenderedCount()).toBe(90);

    // Load final batch
    scroll.loadNextBatch();
    expect(scroll.getRenderedCount()).toBe(100);

    // Clean up
    scroll.destroy();
  });
});
