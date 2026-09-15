import { describe, it, expect } from 'bun:test';
import { Asset } from '../../core/entities/Asset.ts';

describe('Asset entity', () => {
  it('should create an asset instance with proper fields', () => {
    const asset = new Asset('PETR4', 'stock', 'Petróleo e Gás');
    expect(asset.ticker).toBe('PETR4');
    expect(asset.type).toBe('stock');
    expect(asset.sector).toBe('Petróleo e Gás');
  });
});
