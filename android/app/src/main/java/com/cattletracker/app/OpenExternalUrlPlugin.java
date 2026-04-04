package com.cattletracker.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Открывает URL во внешнем приложении (обычно Chrome). Нужно для скачивания APK:
 * Custom Tabs из @capacitor/browser часто показывают пустой экран для application/vnd.android.package-archive.
 */
@CapacitorPlugin(name = "OpenExternalUrl")
public class OpenExternalUrlPlugin extends Plugin {

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Не указан url");
            return;
        }
        try {
            Uri uri = Uri.parse(url);
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Не удалось открыть ссылку", e);
        }
    }
}
