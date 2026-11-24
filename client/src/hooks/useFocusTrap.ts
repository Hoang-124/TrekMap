import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface FocusTrapEntry {
  id: symbol;
  getContainer: () => HTMLElement | null;
}

/**
 * Module-level LIFO stack of currently active modal focus traps.
 * Ensures stacked modals never hijack Tab or close in inverse Escape order.
 */
const activeTrapStack: FocusTrapEntry[] = [];

function getTopmostTrapContainer(): HTMLElement | null {
  for (let i = activeTrapStack.length - 1; i >= 0; i -= 1) {
    const el = activeTrapStack[i].getContainer();
    if (el && el.isConnected) {
      return el;
    }
  }
  return null;
}

/**
 * Returns true if `container` is the topmost active focus trap (or no trap stack is active).
 * Modals should call this in their Escape / keydown listeners to enforce strict LIFO handling.
 */
export function isTopmostFocusTrap(container: HTMLElement | null): boolean {
  const top = getTopmostTrapContainer();
  if (!top) return true;
  if (!container) return false;
  return top === container;
}

function getVisibleFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return candidates.filter((el) => {
    if (
      el.hasAttribute('disabled') ||
      el.getAttribute('aria-hidden') === 'true' ||
      Boolean(el.closest('[aria-hidden="true"], [inert]'))
    ) {
      return false;
    }
    if (typeof window !== 'undefined') {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
    }
    return el.getClientRects().length > 0;
  });
}

function focusFallbackTarget(): void {
  const remainingTop = getTopmostTrapContainer();
  if (remainingTop) {
    const topFocusables = getVisibleFocusableElements(remainingTop);
    (topFocusables[0] || remainingTop).focus({ preventScroll: true });
    return;
  }

  const fallback =
    document.querySelector<HTMLElement>('main[tabindex]') ||
    document.querySelector<HTMLElement>('header button:not([disabled]), nav a[href]') ||
    document.querySelector<HTMLElement>('main') ||
    document.getElementById('root');

  if (!fallback) return;
  if (!fallback.hasAttribute('tabindex') && (fallback.tagName === 'MAIN' || fallback.id === 'root')) {
    fallback.setAttribute('tabindex', '-1');
  }
  fallback.focus({ preventScroll: true });
}

export interface UseFocusTrapOptions {
  /** Optional preferred element to receive initial focus when opening. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Restore focus to the trigger element when closing. Defaults to true. */
  restoreFocus?: boolean;
}

/**
 * Reusable accessible focus-trap hook for LOST modals and dialogs.
 * Cycles Tab / Shift+Tab within the topmost active `containerRef` while `isOpen` is true
 * and restores focus to the previously focused element (or a safe landmark fallback) on close.
 */
export function useFocusTrap(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options?: UseFocusTrapOptions
): void {
  const initialFocusRef = options?.initialFocusRef;
  const restoreFocus = options?.restoreFocus ?? true;

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const entryId = Symbol('lost-focus-trap');
    activeTrapStack.push({
      id: entryId,
      getContainer: () => containerRef.current,
    });

    const previousFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const rafId = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container || !isTopmostFocusTrap(container)) return;

      const preferred = initialFocusRef?.current;
      if (
        preferred &&
        container.contains(preferred) &&
        !preferred.hasAttribute('disabled') &&
        !preferred.closest('[aria-hidden="true"], [inert]')
      ) {
        preferred.focus({ preventScroll: true });
        return;
      }

      if (!container.contains(document.activeElement)) {
        const focusables = getVisibleFocusableElements(container);
        if (focusables.length > 0) {
          focusables[0].focus({ preventScroll: true });
        } else {
          container.focus({ preventScroll: true });
        }
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container || !isTopmostFocusTrap(container)) return;

      const focusables = getVisibleFocusableElements(container);
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);

      const idx = activeTrapStack.findIndex((entry) => entry.id === entryId);
      if (idx !== -1) {
        activeTrapStack.splice(idx, 1);
      }

      if (restoreFocus) {
        const remainingTop = getTopmostTrapContainer();
        const canRestorePrevious =
          Boolean(previousFocused) &&
          previousFocused !== document.body &&
          Boolean(previousFocused?.isConnected) &&
          Boolean(previousFocused && previousFocused.getClientRects().length > 0) &&
          (!remainingTop || Boolean(previousFocused && remainingTop.contains(previousFocused)));

        if (canRestorePrevious && previousFocused) {
          previousFocused.focus({ preventScroll: true });
        } else {
          focusFallbackTarget();
        }
      }
    };
  }, [isOpen, containerRef, initialFocusRef, restoreFocus]);
}
