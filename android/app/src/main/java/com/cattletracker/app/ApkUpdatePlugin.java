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
 * Прогресс и отмена — в UI приложения, без очереди DownloadManager.
 */
@CapacitorPlugin(name = "ApkUpdate")
public class ApkUpdatePlugin extends Plugin {

    private static final String APK_CACHE_NAME = "cattle-tracker-update.apk";
    private static final int CONNECT_TIMEOUT_MS = 30000;
    private static final int READ_TIMEOUT_MS = 120000;
    private static final int MIN_APK_BYTES = 1024;
    public static final String ERR_NEED_INSTALL_PERMISSION = "NEED_INSTALL_PERMISSION";
    public static final String ERR_CANCELED = "CANCELED";

    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);
    private final AtomicBoolean downloadRunning = new AtomicBoolean(false);
    private volatile HttpURLConnection currentConn;
    private volatile Thread downloadThread;

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Не указан url");
            return;
        }
        if (!downloadRunning.compareAndSet(false, true)) {
            call.reject("Загрузка уже идёт");
            return;
        }
        cancelRequested.set(false);
        currentConn = null;

        Thread t = new Thread(() -> {
            File out = new File(getContext().getCacheDir(), APK_CACHE_NAME);
            try {
                if (out.exists() && !out.delete()) {
                    call.reject("Не удалось удалить предыдущий файл обновления");
                    return;
                }
                downloadToFile(url, out);
                if (cancelRequested.get()) {
                    if (out.exists()) out.delete();
                    call.reject(ERR_CANCELED);
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
            } catch (CanceledException e) {
                if (out.exists()) out.delete();
                call.reject(ERR_CANCELED);
            } catch (Exception e) {
                if (out.exists()) out.delete();
                if (cancelRequested.get()) {
                    call.reject(ERR_CANCELED);
                } else {
                    call.reject(e.getMessage() != null ? e.getMessage() : "Ошибка загрузки", e);
                }
            } finally {
                downloadRunning.set(false);
                currentConn = null;
                downloadThread = null;
            }
        });
        downloadThread = t;
        t.start();
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelRequested.set(true);
        HttpURLConnection conn = currentConn;
        if (conn != null) {
            try {
                conn.disconnect();
            } catch (Exception ignored) {}
        }
        Thread t = downloadThread;
        if (t != null) {
            try {
                t.interrupt();
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        openInstallUnknownAppsSettings();
        call.resolve();
    }

    private void notifyProgress(long loaded, long expected) {
        JSObject data = new JSObject();
        data.put("loaded", loaded);
        data.put("total", expected > 0 ? expected : 0);
        int pct = expected > 0 ? (int) Math.min(100, Math.round(100.0 * loaded / expected)) : 0;
        data.put("percent", pct);
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> notifyListeners("progress", data));
        } else {
            notifyListeners("progress", data);
        }
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
            conn.setRequestProperty("Accept-Encoding", "identity");
            if (cancelRequested.get()) {
                throw new CanceledException();
            }
            notifyProgress(0, 0);
            conn.connect();
            if (cancelRequested.get()) {
                throw new CanceledException();
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
            long lastNotify = 0;
            notifyProgress(0, expected > 0 ? expected : 0);
            while ((n = in.read(buf)) != -1) {
                if (cancelRequested.get()) {
                    throw new CanceledException();
                }
                fos.write(buf, 0, n);
                total += n;
                if (total - lastNotify >= 32 * 1024 || (expected > 0 && total >= expected)) {
                    lastNotify = total;
                    notifyProgress(total, expected > 0 ? expected : total);
                }
            }
            fos.flush();
            notifyProgress(total, expected > 0 ? expected : total);
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

    private static class CanceledException extends Exception {
        CanceledException() {
            super(ERR_CANCELED);
        }
    }
}
