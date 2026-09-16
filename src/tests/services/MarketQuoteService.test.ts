import { describe, it, expect } from 'bun:test';
import { MarketQuoteService, MarketQuote } from '../../core/services/MarketQuoteService.ts';
import { ConsolidatedPosition } from '../../core/entities/ConsolidatedPosition.ts';

describe('MarketQuoteService', () => {
  it('should parse valid Yahoo Finance chart response correctly', () => {
    const mockYahooPayload = {
      chart: {
        result: [
          {
            meta: {
              currency: 'BRL',
              symbol: 'PETR4.SA',
              regularMarketPrice: 38.5,
              regularMarketChangePercent: 2.15,
              previousClose: 37.69,
            },
          },
        ],
        error: null,
      },
    };

    const quote = MarketQuoteService.parseYahooResponse(mockYahooPayload, 'PETR4');
    expect(quote).not.toBeNull();
    expect(quote!.ticker).toBe('PETR4');
    expect(quote!.price).toBe(38.5);
    expect(quote!.changePercent).toBeCloseTo(2.15, 2);
    expect(quote!.previousClose).toBe(37.69);
    expect(quote!.changeAmount).toBeCloseTo(0.81, 2);
    expect(quote!.source).toBe('yahoo');
  });

  it('should parse valid Brapi response correctly', () => {
    const mockBrapiPayload = {
      results: [
        {
          symbol: 'HGLG11',
          regularMarketPrice: 155.2,
          regularMarketChangePercent: -0.45,
          regularMarketPreviousClose: 155.9,
        },
      ],
    };

    const quote = MarketQuoteService.parseBrapiResponse(mockBrapiPayload, 'HGLG11');
    expect(quote).not.toBeNull();
    expect(quote!.ticker).toBe('HGLG11');
    expect(quote!.price).toBe(155.2);
    expect(quote!.changePercent).toBeCloseTo(-0.45, 2);
    expect(quote!.previousClose).toBe(155.9);
    expect(quote!.source).toBe('brapi');
  });

  it('should return null on malformed responses', () => {
    expect(MarketQuoteService.parseYahooResponse({}, 'PETR4')).toBeNull();
    expect(MarketQuoteService.parseYahooResponse({ chart: { result: [] } }, 'PETR4')).toBeNull();
    expect(MarketQuoteService.parseBrapiResponse({}, 'PETR4')).toBeNull();
  });

  it('should calculate position market result with gain', () => {
    const position = new ConsolidatedPosition(
      'PETR4',
      100, // quantity: 100 shares
      30.0, // averagePrice: R$ 30,00
      3000.0, // totalCost: R$ 3.000,00
      'stock',
    );

    const quote: MarketQuote = {
      ticker: 'PETR4',
      price: 36.0,
      changePercent: 1.5,
      changeAmount: 0.5,
      previousClose: 35.5,
      updatedAt: new Date().toISOString(),
      source: 'yahoo',
    };

    const result = MarketQuoteService.calculatePositionResult(position, quote);
    expect(result.hasQuote).toBe(true);
    expect(result.marketPrice).toBe(36.0);
    expect(result.marketValue).toBe(3600.0); // 100 * 36
    expect(result.profitLoss).toBe(600.0); // 3600 - 3000
    expect(result.profitLossPercent).toBe(20.0); // (600 / 3000) * 100
  });

  it('should calculate position market result with loss', () => {
    const position = new ConsolidatedPosition(
      'HGLG11',
      10, // quantity: 10 shares
      160.0, // averagePrice: R$ 160,00
      1600.0, // totalCost: R$ 1.600,00
      'fii',
    );

    const quote: MarketQuote = {
      ticker: 'HGLG11',
      price: 150.0,
      changePercent: -1.0,
      changeAmount: -1.5,
      previousClose: 151.5,
      updatedAt: new Date().toISOString(),
      source: 'yahoo',
    };

    const result = MarketQuoteService.calculatePositionResult(position, quote);
    expect(result.hasQuote).toBe(true);
    expect(result.marketPrice).toBe(150.0);
    expect(result.marketValue).toBe(1500.0);
    expect(result.profitLoss).toBe(-100.0);
    expect(result.profitLossPercent).toBeCloseTo(-6.25, 2);
  });

  it('should handle position calculation gracefully when no quote is provided', () => {
    const position = new ConsolidatedPosition('CPTI11', 50, 10.0, 500.0, 'fi-infra');
    const result = MarketQuoteService.calculatePositionResult(position, undefined);

    expect(result.hasQuote).toBe(false);
    expect(result.marketPrice).toBe(10.0);
    expect(result.marketValue).toBe(500.0);
    expect(result.profitLoss).toBe(0);
    expect(result.profitLossPercent).toBe(0);
  });

  it('should fail over to the second mirror if the first mirror fails', async () => {
    const service = new MarketQuoteService();

    let callCount = 0;
    const mockFetch = async (url: string | URL | Request) => {
      callCount++;
      const urlStr = url.toString();
      if (urlStr.includes('yahoo1')) {
        throw new Error('Network error on mirror 1');
      }
      if (urlStr.includes('yahoo2')) {
        return new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    symbol: 'PETR4.SA',
                    regularMarketPrice: 42.0,
                    regularMarketChangePercent: 1.0,
                    previousClose: 41.5,
                  },
                },
              ],
            },
          }),
          { status: 200 },
        );
      }
      return new Response('Not found', { status: 404 });
    };

    const quote = await service.fetchQuote('PETR4', mockFetch as unknown as typeof fetch);
    expect(quote).not.toBeNull();
    expect(quote!.price).toBe(42.0);
    expect(callCount).toBe(2);
  });
});
