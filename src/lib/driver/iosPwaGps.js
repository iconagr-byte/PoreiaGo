/**
 * iOS PWA GPS — detection, Greek guidance copy, background limits.
 */

const DISMISS_STORAGE_KEY = 'driver_ios_gps_guidance_dismissed_v1';

export function detectIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isClassicIos = /iPad|iPhone|iPod/i.test(ua);
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isClassicIos || isIpadOs;
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  if (window.navigator.standalone === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export function getIosGpsEnvironment() {
  const isIos = detectIosDevice();
  const isStandalone = isStandalonePwa();
  return {
    isIos,
    isStandalone,
    needsInstallGuidance: isIos && !isStandalone,
    needsKeepForegroundWarning: isIos,
  };
}

export function geolocationErrorToGreek(error, { isIos = detectIosDevice() } = {}) {
  const code = error?.code;
  if (code === 1) {
    return isIos
      ? 'Άρνηση τοποθεσίας — Ρυθμίσεις iPhone → Απόρρητο & Ασφάλεια → Υπηρεσίες τοποθεσίας → Safari (ή Chrome) → «Κατά τη διάρκεια χρήσης της εφαρμογής»'
      : 'Άρνηση πρόσβασης GPS — ενεργοποιήστε την τοποθεσία στον browser';
  }
  if (code === 2) return 'Η τοποθεσία δεν είναι διαθέσιμη αυτή τη στιγμή';
  if (code === 3) {
    return isIos
      ? 'Λήξη χρόνου GPS — βγείτε σε ανοιχτό χώρο και κρατήστε την εφαρμογή σε πρώτο πλάνο'
      : 'Λήξη χρόνου αναμονής GPS — δοκιμάστε σε ανοιχτό χώρο';
  }
  return error?.message || 'Σφάλμα GPS';
}

export const IOS_GPS_GUIDANCE_STEPS = [
  {
    id: 'install',
    icon: 'add_to_home_screen',
    title: 'Προσθήκη στην Αρχική',
    body: 'Στο Safari πατήστε «Κοινοποίηση» (τετράγωνο με βέλος) → «Προσθήκη στην Αρχική οθόνη». Ανοίξτε μετά την εφαρμογή από το εικονίδιο, όχι από καρτέλα Safari.',
    showWhen: (env) => env.needsInstallGuidance,
  },
  {
    id: 'location',
    icon: 'location_on',
    title: 'Άδεια τοποθεσίας',
    body: 'Όταν ζητηθεί, επιλέξτε «Κατά τη διάρκεια χρήσης της εφαρμογής» ή «Να επιτρέπεται». Μην επιλέξτε «Μία φορά» ή «Ποτέ».',
    showWhen: () => true,
  },
  {
    id: 'foreground',
    icon: 'stay_current_portrait',
    title: 'Κρατήστε την εφαρμογή ανοιχτή',
    body: 'Στο iOS το GPS σταματά ή καθυστερεί όταν αλλάζετε εφαρμογή ή κλειδώνετε την οθόνη. Κρατήστε το GPS Οδηγού σε πρώτο πλάνο κατά τη βάρδια.',
    showWhen: (env) => env.needsKeepForegroundWarning,
  },
  {
    id: 'power',
    icon: 'battery_saver',
    title: 'Λειτουργία χαμηλής κατανάλωσης',
    body: 'Απενεργοποιήστε τη «Χαμηλή κατανάλωση» (Low Power Mode) κατά τη βάρδια — μειώνει την ακρίβεια GPS.',
    showWhen: (env) => env.isIos,
  },
  {
    id: 'screen',
    icon: 'light_mode',
    title: 'Οθόνη ενεργή',
    body: 'Μειώστε τη φωτεινότητα αν θέλετε, αλλά μην κλειδώνετε την οθόνη. Η εφαρμογή προσπαθεί να κρατήσει την οθόνη ενεργή (Wake Lock).',
    showWhen: (env) => env.isIos,
  },
];

export function getVisibleGuidanceSteps(env = getIosGpsEnvironment()) {
  if (!env.isIos) return [];
  return IOS_GPS_GUIDANCE_STEPS.filter((step) => !step.showWhen || step.showWhen(env));
}

export function isGuidanceDismissed() {
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissGuidance() {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function resetGuidanceDismissal() {
  try {
    localStorage.removeItem(DISMISS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function iosGeolocationOptions(isIos = detectIosDevice()) {
  return {
    enableHighAccuracy: true,
    maximumAge: isIos ? 5000 : 4000,
    timeout: isIos ? 20000 : 15000,
  };
}

export function formatRateLimitedMessage(retryAfterSec) {
  const sec = Math.max(1, Math.round(Number(retryAfterSec) || 1));
  return `Πολλά GPS σημεία — δοκιμάστε ξανά σε ${sec} δευτ.`;
}
