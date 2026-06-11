import { useCallback, useEffect, useRef } from 'react';
import { AppState, PanResponder } from 'react-native';

/**
 * Returns panHandlers to spread onto the root activity-detection View.
 * Calls onTimeout() after `timeoutMins` minutes of no touch activity.
 * Pass timeoutMins=null to disable auto-logout entirely.
 */
export function useInactivityTimer(
  timeoutMins: number | null,
  onTimeout: () => void,
) {
  const lastActivityAt = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetActivity = useCallback(() => {
    lastActivityAt.current = Date.now();
  }, []);

  // Set up / clear the polling interval whenever timeoutMins changes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutMins === null) return;

    const timeoutMs = timeoutMins * 60 * 1000;
    timerRef.current = setInterval(() => {
      if (Date.now() - lastActivityAt.current >= timeoutMs) {
        onTimeoutRef.current();
      }
    }, 30_000); // check every 30 s

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeoutMins]);

  // Also check inactivity when the app comes back to the foreground
  useEffect(() => {
    if (timeoutMins === null) return;
    const timeoutMs = timeoutMins * 60 * 1000;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (Date.now() - lastActivityAt.current >= timeoutMs) {
          onTimeoutRef.current();
        } else {
          resetActivity();
        }
      }
    });
    return () => sub.remove();
  }, [timeoutMins, resetActivity]);

  // PanResponder: capture phase intercepts every touch without consuming it
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetActivity();
        return false; // don't claim the responder — let children handle it normally
      },
    }),
  ).current;

  return panResponder.panHandlers;
}
