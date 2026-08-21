package com.cattletracker.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/**
 * Системный диалог «Сохранить как» (ACTION_CREATE_DOCUMENT) — Word/HTML с телефона.
 */
@CapacitorPlugin(name = "SaveDocument")
public class SaveDocumentPlugin extends Plugin {

    @PluginMethod
    public void saveFile(PluginCall call) {
        String filename = call.getString("filename");
        String mime = call.getString("mime");
        String base64 = call.getString("base64");
        if (filename == null || filename.isEmpty()) {
            call.reject("Не указано имя файла");
            return;
        }
        if (base64 == null || base64.isEmpty()) {
            call.reject("Пустой файл");
            return;
        }
        if (mime == null || mime.isEmpty()) {
            mime = "application/msword";
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "onSavePicked");
    }

    @ActivityCallback
    private void onSavePicked(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject o = new JSObject();
            o.put("cancelled", true);
            call.resolve(o);
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) {
            JSObject o = new JSObject();
            o.put("cancelled", true);
            call.resolve(o);
            return;
        }
        String base64 = call.getString("base64");
        OutputStream os = null;
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            os = getContext().getContentResolver().openOutputStream(uri);
            if (os == null) {
                call.reject("Не удалось открыть файл");
                return;
            }
            os.write(bytes);
            os.flush();
            JSObject ok = new JSObject();
            ok.put("cancelled", false);
            call.resolve(ok);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Ошибка сохранения", e);
        } finally {
            if (os != null) {
                try {
                    os.close();
                } catch (Exception ignored) {}
            }
        }
    }
}
