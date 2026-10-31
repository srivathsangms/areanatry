import { describe, it, expect } from 'vitest';
import { distance, extractDestination, instruction } from './navigation';
describe('navigation helpers', () => {
  it('extracts spoken destinations', () => { expect(extractDestination('Hey Vish, I need to go to Marina Beach')).toBe('Marina Beach'); });
  it('calculates distance', () => { expect(distance({lat: 0,lon: 0},{lat: 0,lon: 0.001})).toBeCloseTo(111.2, 0); });
  it('formats a turn', () => { expect(instruction({maneuver:{modifier:'left'},name:'Main Street'})).toBe('Turn left onto Main Street'); });
});
