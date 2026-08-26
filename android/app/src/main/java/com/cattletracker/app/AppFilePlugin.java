package com.cattletracker.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Сохранение файла через системный диалог и отправка (MAX / chooser).
 */
@CapacitorPlugin(name = "AppFile")
public class AppFilePlugin extends Plugin {

    private static final String MAX_PACKAGE = "ru.oneme.app";
    private static final String DOCX_MIME =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    @PluginMethod
    public void saveFile(PluginCall call) {
        String filename = call.getString("filename", "file.docx");
        String mime = call.getString("mime", DOCX_MIME);
        if (call.getString("data") == null || call.getString("data").isEmpty()) {
            call.reject("Нет данных файла");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime != null && !mime.isEmpty() ? mime : "*/*");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "onSavePicked");
    }

    @ActivityCallback
    private void onSavePicked(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSObject out = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            out.put("canceled", true);
            call.resolve(out);
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) {
            out.put("canceled", true);
            call.resolve(out);
            return;
        }
        try {
            byte[] bytes = Base64.decode(call.getString("data"), Base64.DEFAULT);
            OutputStream os = getContext().getContentResolver().openOutputStream(uri);
            if (os == null) {
                call.reject("Не удалось открыть файл для записи");
                return;
            }
            try {
                os.write(bytes);
                os.flush();
            } finally {
                os.close();
            }
            out.put("canceled", false);
            call.resolve(out);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось сохранить файл", e);
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String filename = call.getString("filename", "file.docx");
        String mime = call.getString("mime", DOCX_MIME);
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Нет данных файла");
            return;
        }
        if (mime == null || mime.isEmpty()) {
            mime = DOCX_MIME;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            File out = new File(getContext().getCacheDir(), sanitizeName(filename));
            FileOutputStream fos = new FileOutputStream(out);
            try {
                fos.write(bytes);
                fos.flush();
            } finally {
                fos.close();
            }
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                out
            );
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, filename);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (isPackageInstalled(MAX_PACKAGE)) {
                send.setPackage(MAX_PACKAGE);
                grantUri(uri, MAX_PACKAGE);
            }
            Intent chooser = Intent.createChooser(send, "Отправить в MAX");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Activity activity = getActivity();
            if (activity != null) {
                activity.startActivity(chooser);
            } else {
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(chooser);
            }
            JSObject res = new JSObject();
            res.put("ok", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось отправить файл", e);
        }
    }

    private void grantUri(Uri uri, String packageName) {
        try {
            getContext().grantUriPermission(
                packageName,
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (Exception ignored) {}
        if (Build.VERSION.SDK_INT >= 16) {
            try {
                getContext().getPackageManager().queryIntentActivities(
                    new Intent(Intent.ACTION_SEND).setType("*/*"),
                    PackageManager.MATCH_DEFAULT_ONLY
                );
            } catch (Exception ignored) {}
        }
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            getContext().getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private static String sanitizeName(String name) {
        String n = name != null ? name.trim() : "";
        n = n.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (n.isEmpty()) n = "file.docx";
        return n;
    }
}
