package com.poreiago.wallet;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/**
 * Capgo SocialLogin requires this MainActivity shape for Google on Android
 * (AuthorizationClient intent + offline/scopes paths). See Capgo docs.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Emulator + hardware keyboard: WebView must be focusable or keys never reach <input>.
        ensureWebViewKeyboardFocus(true);
    }

    @Override
    public void onStart() {
        super.onStart();
        // Focusability only — do NOT requestFocus here/onResume/windowFocus.
        // Re-requesting steals IME focus from an already-focused <input> (caret shows, keys die).
        ensureWebViewKeyboardFocus(false);
    }

    private void ensureWebViewKeyboardFocus(boolean requestRootFocus) {
        try {
            if (getBridge() == null) return;
            WebView webView = getBridge().getWebView();
            if (webView == null) return;
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            // Keep descendant focus so tapping an <input> still routes hardware keys.
            webView.setDescendantFocusability(android.view.ViewGroup.FOCUS_AFTER_DESCENDANTS);
            try {
                // UTF-8 + no forced Latin path for Greek IME composition.
                webView.getSettings().setDefaultTextEncodingName("UTF-8");
            } catch (Exception ignored) {
                /* older WebView */
            }
            if (requestRootFocus && !webView.hasFocus()) {
                webView.requestFocus();
            }
        } catch (Exception e) {
            Log.w("MainActivity", "WebView focus setup skipped", e);
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (
            requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN &&
            requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX
        ) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle == null) {
                Log.i("GoogleActivityResult", "SocialLogin handle is null");
                return;
            }
            Plugin plugin = pluginHandle.getInstance();
            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i("GoogleActivityResult", "plugin instance is not SocialLoginPlugin");
                return;
            }
            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    // Capgo marker — never called; leave empty.
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
