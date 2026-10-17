package io.github.xzsxhcsgif.yesterdayme;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupFilePlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null) return;
        bridge.getWebView().getSettings().setAllowFileAccess(false);
        // Imported diary text never becomes navigation or privileged native code.
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            private boolean isLocal(Uri uri) {
                return "https".equals(uri.getScheme()) && "localhost".equals(uri.getHost())
                    && (uri.getPort() == -1 || uri.getPort() == 443);
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isLocal(Uri.parse(url));
            }
        });
    }
}
