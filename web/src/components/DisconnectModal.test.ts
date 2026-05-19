/**
 * Tests for web/src/components/DisconnectModal.svelte
 * CAM-04: Camera disconnect overlay with Retry button.
 *
 * Note on happy-dom CSS variable resolution:
 * happy-dom does not fully resolve CSS custom properties in computed styles.
 * For CSS positioning assertions, we check the component source-level style
 * rather than computed style introspection.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import DisconnectModal from './DisconnectModal.svelte';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Helper: read the component source for CSS assertions that happy-dom cannot compute
const componentSource = readFileSync(
  resolve(__dirname, './DisconnectModal.svelte'),
  'utf-8',
);

describe('DisconnectModal', () => {
  it('does NOT render in the DOM when visible=false', () => {
    const { queryByText } = render(DisconnectModal, {
      props: { visible: false, onRetry: vi.fn() },
    });
    expect(queryByText('Camera disconnected')).toBeNull();
    expect(queryByText('Check the cable and try again.')).toBeNull();
    expect(queryByText('Retry')).toBeNull();
  });

  it('renders heading, body, and Retry button when visible=true', () => {
    const { getByText } = render(DisconnectModal, {
      props: { visible: true, onRetry: vi.fn() },
    });
    expect(getByText('Camera disconnected')).toBeTruthy();
    expect(getByText('Check the cable and try again.')).toBeTruthy();
    expect(getByText('Retry')).toBeTruthy();
  });

  it('modal is positioned as a fixed overlay (position: fixed; inset: 0)', () => {
    // Verify via component source — happy-dom cannot resolve all computed styles
    expect(componentSource).toContain('position: fixed');
    const hasInset = componentSource.includes('inset: 0');
    const hasExplicit =
      componentSource.includes('top: 0') &&
      componentSource.includes('left: 0') &&
      componentSource.includes('width: 100%') &&
      componentSource.includes('height: 100%');
    expect(hasInset || hasExplicit).toBe(true);
  });

  it('clicking Retry calls the onRetry callback exactly once', async () => {
    const onRetry = vi.fn();
    const { getByText } = render(DisconnectModal, {
      props: { visible: true, onRetry },
    });
    const retryButton = getByText('Retry');
    await fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
