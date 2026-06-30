import { useEffect, useState } from 'react';
import { getIosGpsEnvironment } from './iosPwaGps.js';

/**
 * Προειδοποίηση όταν η εφαρμογή πάει background ενώ η βάρδια είναι online (iOS).
 */
export function useIosBackgroundGpsWarning(online) {
  const [backgroundWarning, setBackgroundWarning] = useState('');

  useEffect(() => {
    const env = getIosGpsEnvironment();
    if (!env.isIos) return undefined;

    const onVisibility = () => {
      if (!online) {
        setBackgroundWarning('');
        return;
      }
      if (document.hidden) {
        setBackgroundWarning(
          'Η εφαρμογή δεν είναι σε πρώτο πλάνο — το GPS στο iPhone μπορεί να διακοπεί. Επιστρέψτε στην εφαρμογή GPS Οδηγού.',
        );
      } else {
        setBackgroundWarning('');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [online]);

  return backgroundWarning;
}
