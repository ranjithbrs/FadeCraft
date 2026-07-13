package com.mediq.app;

import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.net.Uri;
import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URISyntaxException;
import com.getcapacitor.BridgeActivity;

@CapacitorPlugin(name = "UPIIntentHandler")
class UPIIntentHandler extends Plugin {
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String scheme = url.getScheme();
        if (scheme == null) return null;

        if ("intent".equals(scheme)) {
            try {
                Intent intent = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                if (intent != null) {
                    if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                        getActivity().startActivity(intent);
                        return true;
                    }
                    String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                    if (fallbackUrl != null) {
                        getBridge().getWebView().loadUrl(fallbackUrl);
                        return true;
                    }
                }
            } catch (URISyntaxException e) {
                e.printStackTrace();
            }
            return true; // prevent loading invalid intent
        }

        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, url);
                getActivity().startActivity(intent);
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return true; // prevent loading unknown scheme
            }
        }

        return null; // Defer to Capacitor policy
    }
}

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Use WindowCompat to enable edge-to-edge
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Set system bar colors to transparent
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);

        // Enhanced WebView settings for Razorpay compatibility
        android.webkit.WebSettings settings = this.bridge.getWebView().getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        registerPlugin(UPIIntentHandler.class);
    }
}
