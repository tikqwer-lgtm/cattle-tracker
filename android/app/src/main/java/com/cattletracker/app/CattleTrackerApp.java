package com.cattletracker.app;

import android.app.Application;
import android.util.Log;

/**
 * Installs native crash handler early; pending crash uploaded after restart.
 */
public class CattleTrackerApp extends Application {
    private static final String TAG = "CtTelemetry";

    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                String stack = Log.getStackTraceString(throwable);
                TelemetryRingLog.append(this, "CRASH: " + (throwable != null ? throwable.toString() : "unknown"));
                if (stack != null && !stack.isEmpty()) {
                    String[] lines = stack.split("\n");
                    int n = Math.min(lines.length, 40);
                    for (int i = 0; i < n; i++) {
                        TelemetryRingLog.append(this, "  " + lines[i]);
                    }
                }
                TelemetryConfig.setPendingReport(this, "native_crash", "Android native_crash");
            } catch (Exception e) {
                Log.e(TAG, "crash handler failed", e);
            }
            if (previous != null) {
                previous.uncaughtException(thread, throwable);
            } else {
                android.os.Process.killProcess(android.os.Process.myPid());
                System.exit(10);
            }
        });
    }
}
