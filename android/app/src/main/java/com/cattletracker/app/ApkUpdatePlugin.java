package com.cattletracker.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Принимает APK кусками из WebView (fetch) и открывает установщик.
 * Сеть идёт в JS — тот же стек, что и остальной API, без зависания HttpURLConnection.
 */
@CapacitorPlugin(name = "ApkUpdate")
public class ApkUpdatePlugin extends Plugin {

    private static final String APK_CACHE_NAME = "cattle-tracker-update.apk";
    private static final int MIN_APK_BYTES = 1024;
    public static final String ERR_NEED_INSTALL_PERMISSION = "NEED_INSTALL_PERMISSION";
    public static final String ERR_CANCELED = "CANCELED";

    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);
    private final Object fileLock = new Object();
    private FileOutputStream apkSink;
    private File apkFile;

    @PluginMethod
    public void startApkFile(PluginCall call) {
        synchronized (fileLock) {
            cancelRequested.set(false);
            closeSinkLocked();
            apkFile = new File(getContext().getCacheDir(), APK_CACHE_NAME);
            if (apkFile.exists() && !apkFile.delete()) {
                call.reject("Не удалось удалить предыдущий файл обновления");
                return;
            }
            try {
                apkSink = new FileOutputStream(apkFile);
                call.resolve();
            } catch (Exception e) {
                apkSink = null;
                call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось открыть файл обновления", e);
            }
        }
    }

    @PluginMethod
    public void appendApkChunk(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.resolve();
            return;
        }
        synchronized (fileLock) {
            if (cancelRequested.get()) {
                call.reject(ERR_CANCELED);
                return;
            }
            if (apkSink == null) {
                call.reject("Файл обновления не открыт");
                return;
            }
            try {
                apkSink.write(Base64.decode(data, Base64.DEFAULT));
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось записать фрагмент APK", e);
            }
        }
    }

    @PluginMethod
    public void finishApkFile(PluginCall call) {
        synchronized (fileLock) {
            try {
                if (apkSink != null) {
                    apkSink.flush();
                }
                closeSinkLocked();
                if (cancelRequested.get()) {
                    deleteApkLocked();
                    call.reject(ERR_CANCELED);
                    return;
                }
                if (apkFile == null || !apkFile.exists() || apkFile.length() < MIN_APK_BYTES) {
                    deleteApkLocked();
                    call.reject("Файл слишком маленький — возможно, ошибка загрузки");
                    return;
                }
                JSObject out = new JSObject();
                out.put("size", apkFile.length());
                call.resolve(out);
            } catch (Exception e) {
                closeSinkLocked();
                deleteApkLocked();
                call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось сохранить APK", e);
            }
        }
    }

    @PluginMethod
    public void installDownloadedApk(PluginCall call) {
        File out;
        synchronized (fileLock) {
            out = apkFile != null ? apkFile : new File(getContext().getCacheDir(), APK_CACHE_NAME);
        }
        if (!out.exists() || out.length() < MIN_APK_BYTES) {
            call.reject("Нет скачанного файла обновления");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            try {
                openInstallIntent(out);
                call.resolve();
            } catch (Exception e) {
                rejectInstall(call, e);
            }
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                openInstallIntent(out);
                call.resolve();
            } catch (Exception e) {
                rejectInstall(call, e);
            }
        });
    }

    /** Старый метод: не качаем в Java — JS уходит в браузер. */
    @PluginMethod
    public void downloadApk(PluginCall call) {
        call.reject("web");
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelRequested.set(true);
        synchronized (fileLock) {
            closeSinkLocked();
            deleteApkLocked();
        }
        call.resolve();
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        openInstallUnknownAppsSettings();
        call.resolve();
    }

    private void rejectInstall(PluginCall call, Exception e) {
        if (!canInstallPackages()) {
            openInstallUnknownAppsSettings();
            call.reject(ERR_NEED_INSTALL_PERMISSION);
        } else {
            call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось открыть установщик", e);
        }
    }

    private void closeSinkLocked() {
        if (apkSink != null) {
            try {
                apkSink.close();
            } catch (Exception ignored) {}
            apkSink = null;
        }
    }

    private void deleteApkLocked() {
        if (apkFile != null && apkFile.exists()) {
            apkFile.delete();
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

    private void openInstallIntent(File apk) {
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apk
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
