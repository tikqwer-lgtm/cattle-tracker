package com.cattletracker.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
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
import java.io.FileInputStream;
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

    private File pendingSaveFile;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String filename = call.getString("filename", "file.docx");
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Нет данных файла");
            return;
        }
        try {
            pendingSaveFile = writeCache(sanitizeName(filename), data);
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(DOCX_MIME);
            intent.putExtra(Intent.EXTRA_TITLE, sanitizeName(filename));
            startActivityForResult(call, intent, "onSavePicked");
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось открыть сохранение", e);
        }
    }

    @ActivityCallback
    private void onSavePicked(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSObject out = new JSObject();
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
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
            byte[] bytes;
            if (pendingSaveFile != null && pendingSaveFile.exists()) {
                bytes = readFile(pendingSaveFile);
            } else {
                String data = call.getString("data");
                if (data == null || data.isEmpty()) {
                    call.reject("Нет данных файла");
                    return;
                }
                bytes = Base64.decode(data, Base64.DEFAULT);
            }
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
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("Нет данных файла");
            return;
        }
        try {
            File out = writeCache(sanitizeName(filename), data);
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                out
            );
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("*/*");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, filename);
            send.setClipData(ClipData.newRawUri(filename, uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Activity activity = getActivity();
            if (activity == null) {
                send.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            }
            if (isPackageInstalled(MAX_PACKAGE)) {
                try {
                    Intent max = new Intent(send);
                    max.setPackage(MAX_PACKAGE);
                    grantUri(uri, MAX_PACKAGE);
                    startIntent(activity, max);
                    JSObject res = new JSObject();
                    res.put("ok", true);
                    call.resolve(res);
                    return;
                } catch (Exception ignored) {}
            }
            Intent chooser = Intent.createChooser(send, "Отправить в MAX");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startIntent(activity, chooser);
            JSObject res = new JSObject();
            res.put("ok", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось отправить файл", e);
        }
    }

    private void startIntent(Activity activity, Intent intent) {
        if (activity != null) {
            activity.startActivity(intent);
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
    }

    private File writeCache(String filename, String base64) throws Exception {
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        File out = new File(getContext().getCacheDir(), filename);
        FileOutputStream fos = new FileOutputStream(out);
        try {
            fos.write(bytes);
            fos.flush();
        } finally {
            fos.close();
        }
        return out;
    }

    private static byte[] readFile(File file) throws Exception {
        FileInputStream in = new FileInputStream(file);
        try {
            byte[] bytes = new byte[(int) file.length()];
            int off = 0;
            int n;
            while (off < bytes.length && (n = in.read(bytes, off, bytes.length - off)) > 0) {
                off += n;
            }
            return bytes;
        } finally {
            in.close();
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
        n = n.replaceAll("(?i)\\.docx\\s*\\((\\d+)\\)\\s*$", " ($1).docx");
        n = n.replaceAll("(?i)\\.docx(\\d+)\\s*$", " ($1).docx");
        if (n.isEmpty()) n = "file.docx";
        if (!n.toLowerCase().endsWith(".docx")) n = n + ".docx";
        return n;
    }
}
