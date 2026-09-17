import { ConsolidatedPosition } from '../entities/ConsolidatedPosition.ts';

export interface MarketQuote {
  ticker: string;
  price: number;
  changePercent: number;
  changeAmount: number;
  previousClose: number;
  updatedAt: string;
  source: 'yahoo' | 'brapi' | 'manual' | 'cache';
}

export interface PositionMarketResult {
  ticker: string;
  quantity: number;
  averagePrice: number;
  totalCost: number;
  marketPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number;
  hasQuote: boolean;
  quote?: MarketQuote;
}

export class MarketQuoteService {
  private static CACHE_KEY = 'mywalletb3_market_quotes';
  private static BRAPI_TOKEN_KEY = 'mywalletb3_brapi_token';

  /**
   * Parses Yahoo Finance chart API response (format from /v8/finance/chart/{ticker}.SA)
   */
  static parseYahooResponse(data: unknown, ticker: string): MarketQuote | null {
    try {
      const json = data as {
        chart?: {
          result?: Array<{
            meta?: {
              symbol?: string;
              regularMarketPrice?: number;
              regularMarketChangePercent?: number;
              fulldayPrice?: number;
              fulldayChangePercent?: number;
              chartPreviousClose?: number;
              previousClose?: number;
            };
          }>;
        };
      };

      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) return null;

      const price = meta.regularMarketPrice ?? meta.fulldayPrice;
      if (typeof price !== 'number' || isNaN(price) || price <= 0) {
        return null;
      }

      const previousClose =
        typeof meta.previousClose === 'number' && meta.previousClose > 0
          ? meta.previousClose
          : typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0
            ? meta.chartPreviousClose
            : price;

      const changePercent =
        typeof meta.regularMarketChangePercent === 'number'
          ? meta.regularMarketChangePercent
          : typeof meta.fulldayChangePercent === 'number'
            ? meta.fulldayChangePercent
            : previousClose > 0
              ? ((price - previousClose) / previousClose) * 100
              : 0;

      const changeAmount = price - previousClose;

      return {
        ticker: ticker.toUpperCase().replace(/\.SA$/, ''),
        price,
        changePercent,
        changeAmount,
        previousClose,
        updatedAt: new Date().toISOString(),
        source: 'yahoo',
      };
    } catch {
      return null;
    }
  }

  /**
   * Parses Brapi API response (format from /api/quote/{ticker})
   */
  static parseBrapiResponse(data: unknown, ticker: string): MarketQuote | null {
    try {
      const json = data as {
        results?: Array<{
          symbol?: string;
          regularMarketPrice?: number;
          regularMarketChangePercent?: number;
          regularMarketPreviousClose?: number;
        }>;
      };

      const result = json?.results?.[0];
      if (!result) return null;

      const price = result.regularMarketPrice;
      if (typeof price !== 'number' || isNaN(price) || price <= 0) {
        return null;
      }

      const previousClose =
        typeof result.regularMarketPreviousClose === 'number' &&
        result.regularMarketPreviousClose > 0
          ? result.regularMarketPreviousClose
          : price;

      const changePercent =
        typeof result.regularMarketChangePercent === 'number'
          ? result.regularMarketChangePercent
          : previousClose > 0
            ? ((price - previousClose) / previousClose) * 100
            : 0;

      const changeAmount = price - previousClose;

      return {
        ticker: ticker.toUpperCase().replace(/\.SA$/, ''),
        price,
        changePercent,
        changeAmount,
        previousClose,
        updatedAt: new Date().toISOString(),
        source: 'brapi',
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetches updated quote for a single asset, with multi-mirror failover
   */
  async fetchQuote(
    ticker: string,
    fetchFn: typeof fetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch,
  ): Promise<MarketQuote | null> {
    const cleanTicker = ticker.toUpperCase().trim().replace(/\.SA$/, '');
    const b3Symbol = `${cleanTicker}.SA`;

    // In Tauri desktop production, there is no Vite proxy; direct HTTPS mirrors are used directly.
    const isTauriDesktop =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'tauri:' ||
        window.location.hostname === 'tauri.localhost' ||
        '__TAURI_INTERNALS__' in window);

    // Ordered list of candidate endpoints
    const endpoints = isTauriDesktop
      ? [
          `https://query1.finance.yahoo.com/v8/finance/chart/${b3Symbol}?interval=1d&range=1d`,
          `https://query2.finance.yahoo.com/v8/finance/chart/${b3Symbol}?interval=1d&range=1d`,
        ]
      : [
          `/api/yahoo1/v8/finance/chart/${b3Symbol}?interval=1d&range=1d`,
          `/api/yahoo2/v8/finance/chart/${b3Symbol}?interval=1d&range=1d`,
          `https://query1.finance.yahoo.com/v8/finance/chart/${b3Symbol}?interval=1d&range=1d`,
          `https://query2.finance.yahoo.com/v8/finance/chart/${b3Symbol}?interval=1d&range=1d`,
        ];

    // Optional Brapi endpoint if token is present
    const brapiToken = this.getBrapiToken();
    if (brapiToken) {
      endpoints.push(`https://brapi.dev/api/quote/${cleanTicker}?token=${brapiToken}`);
    }

    for (const url of endpoints) {
      try {
        const response = await fetchFn(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          continue;
        }

        const data = await response.json();

        // Check if Brapi
        if (url.includes('brapi.dev')) {
          const parsed = MarketQuoteService.parseBrapiResponse(data, cleanTicker);
          if (parsed) return parsed;
        } else {
          // Yahoo
          const parsed = MarketQuoteService.parseYahooResponse(data, cleanTicker);
          if (parsed) return parsed;
        }
      } catch {
        // Try next mirror
        continue;
      }
    }

    // If network failed, fall back to cached quote
    const cached = this.getCachedQuote(cleanTicker);
    if (cached) {
      return {
        ...cached,
        source: 'cache',
      };
    }

    return null;
  }

  /**
   * Fetches quotes for an array of tickers with concurrency control
   */
  async fetchQuotes(
    tickers: string[],
    concurrency = 5,
    fetchFn: typeof fetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch,
  ): Promise<Record<string, MarketQuote>> {
    const results: Record<string, MarketQuote> = {};
    const uniqueTickers = Array.from(new Set(tickers.map((t) => t.toUpperCase().trim())));

    for (let i = 0; i < uniqueTickers.length; i += concurrency) {
      const slice = uniqueTickers.slice(i, i + concurrency);
      const batchPromises = slice.map(async (ticker) => {
        const quote = await this.fetchQuote(ticker, fetchFn);
        if (quote) {
          results[ticker] = quote;
        }
      });

      await Promise.allSettled(batchPromises);
    }

    // Save all retrieved quotes to persistent cache
    if (Object.keys(results).length > 0) {
      this.saveQuotesToCache(results);
    }

    return results;
  }

  /**
   * Calculates market value, gain/loss, and percentages for a consolidated position
   */
  static calculatePositionResult(
    pos: ConsolidatedPosition,
    quote?: MarketQuote,
  ): PositionMarketResult {
    if (!quote || quote.price <= 0) {
      return {
        ticker: pos.ticker,
        quantity: pos.quantity,
        averagePrice: pos.averagePrice,
        totalCost: pos.totalCost,
        marketPrice: pos.averagePrice,
        marketValue: pos.totalCost,
        profitLoss: 0,
        profitLossPercent: 0,
        hasQuote: false,
      };
    }

    const marketPrice = quote.price;
    const marketValue = pos.quantity * marketPrice;
    const profitLoss = marketValue - pos.totalCost;
    const profitLossPercent = pos.totalCost > 0 ? (profitLoss / pos.totalCost) * 100 : 0;

    return {
      ticker: pos.ticker,
      quantity: pos.quantity,
      averagePrice: pos.averagePrice,
      totalCost: pos.totalCost,
      marketPrice,
      marketValue,
      profitLoss,
      profitLossPercent,
      hasQuote: true,
      quote,
    };
  }

  /**
   * Local storage cache management
   */
  saveQuotesToCache(newQuotes: Record<string, MarketQuote>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const existing = this.getCachedQuotes();
      const merged = { ...existing, ...newQuotes };
      localStorage.setItem(MarketQuoteService.CACHE_KEY, JSON.stringify(merged));
    } catch {
      // Ignored if storage full or restricted
    }
  }

  getCachedQuotes(): Record<string, MarketQuote> {
    if (typeof localStorage === 'undefined') return {};
    try {
      const raw = localStorage.getItem(MarketQuoteService.CACHE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, MarketQuote>;
    } catch {
      return {};
    }
  }

  getCachedQuote(ticker: string): MarketQuote | null {
    const quotes = this.getCachedQuotes();
    return quotes[ticker.toUpperCase()] || null;
  }

  saveManualQuote(ticker: string, price: number): MarketQuote {
    const cleanTicker = ticker.toUpperCase().trim();
    const existing = this.getCachedQuote(cleanTicker);
    const previousClose = existing?.price ?? price;
    const quote: MarketQuote = {
      ticker: cleanTicker,
      price,
      changePercent: previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0,
      changeAmount: price - previousClose,
      previousClose,
      updatedAt: new Date().toISOString(),
      source: 'manual',
    };

    this.saveQuotesToCache({ [cleanTicker]: quote });
    return quote;
  }

  saveBrapiToken(token: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MarketQuoteService.BRAPI_TOKEN_KEY, token.trim());
  }

  getBrapiToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(MarketQuoteService.BRAPI_TOKEN_KEY);
      if (stored) return stored;
    }
    try {
      // Fallback to optional env var during local development if configured
      return (import.meta as any).env?.VITE_BRAPI_TOKEN || null;
    } catch {
      return null;
    }
  }
}
