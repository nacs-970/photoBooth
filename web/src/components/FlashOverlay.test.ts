/**
 * Tests for web/src/components/FlashOverlay.svelte
 * SESS-02: Full-screen white flash overlay (D-12)
 *
 * Note on happy-dom CSS variable resolution:
 * happy-dom does not fully resolve CSS custom properties in computed styles.
 * For CSS transition assertions, we check the component source-level style
 * rather than computed style introspection.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import FlashOverlay from './FlashOverlay.svelte';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Helper: read the component source for assertions that happy-dom cannot compute
const componentSource = readFileSync(
  resolve(__dirname, './FlashOverlay.svelte'),
  'utf-8',
);

describe('FlashOverlay', () => {
  it('renders a div with data-testid="flash-overlay"', () => {
    const { getByTestId } = render(FlashOverlay, { props: { visible: false } });
    expect(getByTestId('flash-overlay')).toBeTruthy();
  });

  it('has opacity 1 when visible={true}', () => {
    const { getByTestId } = render(FlashOverlay, { props: { visible: true } });
    const el = getByTestId('flash-overlay') as HTMLElement;
    // The .visible class should be applied
    expect(el.classList.contains('visible')).toBe(true);
  });

  it('has opacity 0 (no .visible class) when visible={false}', () => {
    const { getByTestId } = render(FlashOverlay, { props: { visible: false } });
    const el = getByTestId('flash-overlay') as HTMLElement;
    expect(el.classList.contains('visible')).toBe(false);
  });

  it('CSS style declares transition with opacity', () => {
    expect(componentSource).toContain('transition:');
    expect(componentSource).toContain('opacity');
  });

  it('CSS style declares position: fixed', () => {
    expect(componentSource).toContain('position: fixed');
  });

  it('CSS style declares inset: 0 or equivalent coverage', () => {
    // Either inset: 0 or (top:0 + left:0 + width:100% + height:100%)
    const hasInset = componentSource.includes('inset: 0');
    const hasExplicit =
      componentSource.includes('top: 0') &&
      componentSource.includes('left: 0') &&
      componentSource.includes('width: 100%') &&
      componentSource.includes('height: 100%');
    expect(hasInset || hasExplicit).toBe(true);
  });

  it('CSS style declares background white (#FFFFFF or white)', () => {
    const hasHex = componentSource.includes('#FFFFFF') || componentSource.includes('#ffffff');
    const hasKeyword = componentSource.includes('background: white') || componentSource.includes('background-color: white');
    expect(hasHex || hasKeyword).toBe(true);
  });
});
