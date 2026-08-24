import { describe, expect, it } from 'vitest';
import { extractJson } from './extract-json';

describe('extractJson', () => {
  it('parses a bare object', () => {
    expect(extractJson('{"lead_status":"hot"}')).toEqual({ lead_status: 'hot' });
  });

  it('strips markdown code fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('ignores prose before and after the object', () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it('handles nested objects', () => {
    expect(extractJson('{"a":{"b":{"c":2}}}')).toEqual({ a: { b: { c: 2 } } });
  });

  it('is not fooled by braces inside strings', () => {
    expect(extractJson('{"note":"call him {urgent}"}')).toEqual({ note: 'call him {urgent}' });
  });

  it('handles escaped quotes inside strings', () => {
    expect(extractJson('{"note":"he said \\"yes\\""}')).toEqual({ note: 'he said "yes"' });
  });

  it('returns null when there is no object at all', () => {
    expect(extractJson('I could not determine anything.')).toBeNull();
  });

  it('returns null on a truncated object rather than guessing', () => {
    expect(extractJson('{"service_types":["Tinting"')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(extractJson('')).toBeNull();
  });
});
