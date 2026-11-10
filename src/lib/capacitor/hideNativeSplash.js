/**
 * Release the Capacitor / Android launch splash.
 * Safe on web (no plugin) and if hide was already called.
 */
export async function hideNativeSplash(fadeOutDuration = 150) {
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration });
  } catch {
    /* web, missing plugin, or already hidden */
  }
}
