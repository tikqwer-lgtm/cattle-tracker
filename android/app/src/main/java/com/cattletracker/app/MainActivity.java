package com.cattletracker.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.ValueCallback;
import com.getcapacitor.BridgeActivity;

/**
 * Capacitor activity + UI hang watchdog (JS heartbeat via evaluateJavascript).
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "CtTelemetry";
    private static final long HEARTBEAT_INTERVAL_MS = 10_000L;
    private static final long HEARTBEAT_TIMEOUT_MS = 5_000L;
    private static final int HANG_MISS_THRESHOLD = 3;

    private final Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private int consecutiveMisses = 0;
    private boolean hangReportedThisSession = false;
    private boolean heartbeatStarted = false;

    private final Runnable heartbeatTick = new Runnable() {
        @Override
        public void run() {
            if (isFinishing()) return;
            pingJs();
            heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL_MS);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OpenExternalUrlPlugin.class);
        registerPlugin(ApkUpdatePlugin.class);
        registerPlugin(TelemetryBridgePlugin.class);
        registerPlugin(AuthRememberPlugin.class);
        registerPlugin(SaveDocumentPlugin.class);
        super.onCreate(savedInstanceState);
        TelemetryRingLog.append(this, "lifecycle: MainActivity.onCreate");
        TelemetryUploadWorker.flushPendingIfAny(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        startHeartbeat();
    }

    @Override
    public void onPause() {
        stopHeartbeat();
        super.onPause();
    }

    private void startHeartbeat() {
        if (heartbeatStarted) return;
        heartbeatStarted = true;
        consecutiveMisses = 0;
        heartbeatHandler.postDelayed(heartbeatTick, HEARTBEAT_INTERVAL_MS);
    }

    private void stopHeartbeat() {
        heartbeatStarted = false;
        heartbeatHandler.removeCallbacks(heartbeatTick);
    }

    private void pingJs() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                onHeartbeatMiss();
                return;
            }
            final boolean[] answered = { false };
            Runnable timeout = () -> {
                if (!answered[0]) {
                    onHeartbeatMiss();
                }
            };
            heartbeatHandler.postDelayed(timeout, HEARTBEAT_TIMEOUT_MS);
            getBridge().getWebView().evaluateJavascript(
                "(function(){try{if(typeof window.__ctTelemetryPing==='function'){return window.__ctTelemetryPing();}return 'ok';}catch(e){return 'err';}})()",
                (ValueCallback<String>) value -> {
                    answered[0] = true;
                    heartbeatHandler.removeCallbacks(timeout);
                    if (value == null || "null".equals(value) || "\"err\"".equals(value)) {
                        onHeartbeatMiss();
                    } else {
                        consecutiveMisses = 0;
                    }
                }
            );
        } catch (Exception e) {
            Log.w(TAG, "pingJs failed", e);
            onHeartbeatMiss();
        }
    }

    private void onHeartbeatMiss() {
        consecutiveMisses++;
        TelemetryRingLog.append(this, "heartbeat: miss #" + consecutiveMisses);
        if (consecutiveMisses < HANG_MISS_THRESHOLD) return;
        if (hangReportedThisSession) return;
        if (!TelemetryConfig.canReportHang(this)) {
            TelemetryRingLog.append(this, "heartbeat: hang suppressed (cooldown)");
            return;
        }
        hangReportedThisSession = true;
        consecutiveMisses = 0;
        TelemetryConfig.markHangReported(this);
        TelemetryRingLog.append(this, "heartbeat: UI hang detected — scheduling report");
        TelemetryUploadWorker.uploadNowOrEnqueue(this, "ui_hang", "Android ui_hang");
    }
}
