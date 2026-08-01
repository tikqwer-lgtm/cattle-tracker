package com.cattletracker.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

/**
 * SharedPreferences: API base, JWT, pending crash/hang flags, hang cooldown.
 */
public final class TelemetryConfig {
    private static final String PREFS = "cattle_tracker_telemetry";
    private static final String KEY_API_BASE = "apiBase";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_PENDING_KIND = "pendingKind";
    private static final String KEY_PENDING_MESSAGE = "pendingMessage";
    private static final String KEY_LAST_HANG_AT = "lastHangAt";

    private TelemetryConfig() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void setUploadConfig(Context ctx, String apiBase, String token) {
        SharedPreferences.Editor ed = prefs(ctx).edit();
        if (apiBase != null && !apiBase.isEmpty()) {
            ed.putString(KEY_API_BASE, apiBase.trim().replaceAll("/+$", ""));
        } else {
            ed.remove(KEY_API_BASE);
        }
        if (token != null && !token.isEmpty()) {
            ed.putString(KEY_TOKEN, token);
        } else {
            ed.remove(KEY_TOKEN);
        }
        ed.apply();
    }

    public static void clearUploadConfig(Context ctx) {
        prefs(ctx).edit().remove(KEY_API_BASE).remove(KEY_TOKEN).apply();
    }

    public static String getApiBase(Context ctx) {
        return prefs(ctx).getString(KEY_API_BASE, null);
    }

    public static String getToken(Context ctx) {
        return prefs(ctx).getString(KEY_TOKEN, null);
    }

    public static boolean hasUploadConfig(Context ctx) {
        String base = getApiBase(ctx);
        String token = getToken(ctx);
        return base != null && !base.isEmpty() && token != null && !token.isEmpty();
    }

    public static void setPendingReport(Context ctx, String kind, String message) {
        prefs(ctx).edit()
            .putString(KEY_PENDING_KIND, kind != null ? kind : "unknown")
            .putString(KEY_PENDING_MESSAGE, message != null ? message : "")
            .apply();
    }

    public static String getPendingKind(Context ctx) {
        return prefs(ctx).getString(KEY_PENDING_KIND, null);
    }

    public static String getPendingMessage(Context ctx) {
        return prefs(ctx).getString(KEY_PENDING_MESSAGE, "");
    }

    public static void clearPendingReport(Context ctx) {
        prefs(ctx).edit().remove(KEY_PENDING_KIND).remove(KEY_PENDING_MESSAGE).apply();
    }

    public static boolean hasPendingReport(Context ctx) {
        String kind = getPendingKind(ctx);
        return kind != null && !kind.isEmpty();
    }

    /** Cooldown for ui_hang reports (ms). */
    public static final long HANG_COOLDOWN_MS = 20L * 60L * 1000L;

    public static boolean canReportHang(Context ctx) {
        long last = prefs(ctx).getLong(KEY_LAST_HANG_AT, 0L);
        return System.currentTimeMillis() - last >= HANG_COOLDOWN_MS;
    }

    public static void markHangReported(Context ctx) {
        prefs(ctx).edit().putLong(KEY_LAST_HANG_AT, System.currentTimeMillis()).apply();
    }

    public static String getAppVersion(Context ctx) {
        try {
            PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return pi.versionName != null ? pi.versionName : String.valueOf(pi.versionCode);
        } catch (PackageManager.NameNotFoundException e) {
            return "unknown";
        }
    }
}
