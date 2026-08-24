package com.cattletracker.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Скачивает APK в cache приложения (один файл с перезаписью) и открывает установщик.
 * Шлёт прогресс в JS и умеет отменять загрузку.
 */
@CapacitorPlugin(name = "ApkUpdate")
public class ApkUpdatePlugin extends Plugin {

    private static final String APK_CACHE_NAME = "cattle-tracker-update.apk";
    private static final int CONNECT_TIMEOUT_MS = 30000;
    private static final int READ_TIMEOUT_MS = 120000;
    private static final int MIN_APK_BYTES = 1024;
    public static final String ERR_NEED_INSTALL_PERMISSION = "NEED_INSTALL_PERMISSION";
    public static final String ERR_CANCELLED = "CANCELLED";

    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private volatile HttpURLConnection currentConn;

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Не указан url");
            return;
        }

        cancelled.set(false);
        new Thread(() -> {
            try {
                File out = new File(getContext().getCacheDir(), APK_CACHE_NAME);
                if (out.exists() && !out.delete()) {
                    call.reject("Не удалось удалить предыдущий файл обновления");
                    return;
                }
                downloadToFile(url, out);
                if (cancelled.get()) {
                    if (out.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        out.delete();
                    }
                    call.reject(ERR_CANCELLED);
                    return;
                }
                getActivity().runOnUiThread(() -> {
                    try {
                        openInstallIntent(out);
                        call.resolve();
                    } catch (Exception e) {
                        if (!canInstallPackages()) {
                            openInstallUnknownAppsSettings();
                            call.reject(ERR_NEED_INSTALL_PERMISSION);
                        } else {
                            call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось открыть установщик", e);
                        }
                    }
                });
            } catch (Exception e) {
                if (cancelled.get() || ERR_CANCELLED.equals(e.getMessage())) {
                    call.reject(ERR_CANCELLED);
                    return;
                }
                call.reject(e.getMessage() != null ? e.getMessage() : "Ошибка загрузки", e);
            } finally {
                currentConn = null;
            }
        }).start();
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelled.set(true);
        HttpURLConnection conn = currentConn;
        if (conn != null) {
            try {
                conn.disconnect();
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        openInstallUnknownAppsSettings();
        call.resolve();
    }

    private void emitProgress(long loaded, long total) {
        JSObject data = new JSObject();
        int percent = total > 0 ? (int) Math.min(100, (loaded * 100) / total) : -1;
        data.put("percent", percent);
        data.put("loaded", loaded);
        data.put("total", total);
        notifyListeners("progress", data);
    }

    private void downloadToFile(String urlStr, File out) throws Exception {
        HttpURLConnection conn = null;
        InputStream in = null;
        FileOutputStream fos = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            currentConn = conn;
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setInstanceFollowRedirects(true);
            conn.connect();
            if (cancelled.get()) {
                throw new Exception(ERR_CANCELLED);
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new Exception("Сервер вернул код " + code);
            }
            long expected = conn.getContentLengthLong();
            in = conn.getInputStream();
            fos = new FileOutputStream(out);
            byte[] buf = new byte[8192];
            long total = 0;
            int n;
            long lastEmit = 0;
            emitProgress(0, expected);
            while ((n = in.read(buf)) != -1) {
                if (cancelled.get()) {
                    throw new Exception(ERR_CANCELLED);
                }
                fos.write(buf, 0, n);
                total += n;
                if (total - lastEmit >= 64 * 1024 || (expected > 0 && total == expected)) {
                    lastEmit = total;
                    emitProgress(total, expected);
                }
            }
            fos.flush();
            emitProgress(total, expected > 0 ? expected : total);
            if (cancelled.get()) {
                throw new Exception(ERR_CANCELLED);
            }
            if (total < MIN_APK_BYTES) {
                out.delete();
                throw new Exception("Файл слишком маленький — возможно, ошибка загрузки");
            }
            if (expected > 0 && total != expected) {
                out.delete();
                throw new Exception("Загрузка прервана");
            }
        } finally {
            if (fos != null) {
                try {
                    fos.close();
                } catch (Exception ignored) {}
            }
            if (in != null) {
                try {
                    in.close();
                } catch (Exception ignored) {}
            }
            if (conn != null) {
                conn.disconnect();
            }
            currentConn = null;
        }
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void openInstallUnknownAppsSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            activity.startActivity(intent);
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                activity.startActivity(intent);
            } catch (Exception ignored) {}
        }
    }

    private void openInstallIntent(File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Activity activity = getActivity();
        if (activity != null) {
            activity.startActivity(intent);
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
    }
}
