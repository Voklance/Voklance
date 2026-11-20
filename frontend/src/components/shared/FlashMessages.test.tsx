// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { FlashProvider, useFlash } from './FlashMessages';

function Triggers() {
  const { showFlash } = useFlash();
  return (
    <>
      <button onClick={() => showFlash({ type: 'success', message: 'Saved successfully.' })}>Success</button>
      <button onClick={() => showFlash({ type: 'error', message: 'Save failed.' })}>Error</button>
      <button onClick={() => showFlash({ type: 'warning', message: 'Complete the required fields.' })}>
        Warning
      </button>
      <button
        onClick={() =>
          showFlash({ type: 'info', message: 'Your invitation is ready.', to: '/app/notifications' })
        }
      >
        Info
      </button>
    </>
  );
}

afterEach(cleanup);

describe('flash messages', () => {
  it('shows all four variants and lets the user dismiss one', () => {
    render(
      <MemoryRouter>
        <FlashProvider>
          <Triggers />
        </FlashProvider>
      </MemoryRouter>
    );
    for (const label of ['Success', 'Error', 'Warning', 'Info'])
      fireEvent.click(screen.getByRole('button', { name: label }));

    expect(screen.getByText('Saved successfully.').closest('[data-type]')?.getAttribute('data-type')).toBe(
      'success'
    );
    expect(screen.getByText('Save failed.').closest('[data-type]')?.getAttribute('data-type')).toBe('error');
    expect(
      screen.getByText('Complete the required fields.').closest('[data-type]')?.getAttribute('data-type')
    ).toBe('warning');
    expect(screen.getByRole('link', { name: /Your invitation is ready/ }).getAttribute('href')).toBe(
      '/app/notifications'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Oh snap! message' }));
    expect(screen.queryByText('Save failed.')).toBeNull();
    expect(screen.getByText('Saved successfully.')).toBeTruthy();
  });
});
