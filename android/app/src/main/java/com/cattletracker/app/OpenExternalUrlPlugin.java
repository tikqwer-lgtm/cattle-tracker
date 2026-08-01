package com.cattletracker.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Открывает URL во внешнем приложении через системный Intent (не Custom Tabs).
 * Для ссылок max.ru пытается сразу открыть мессенджер MAX (ru.oneme.app).
 */
@CapacitorPlugin(name = "OpenExternalUrl")
public class OpenExternalUrlPlugin extends Plugin {

    private static final String MAX_PACKAGE = "ru.oneme.app";

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

            String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";
            boolean isMaxShare =
                ("max.ru".equals(host) || "www.max.ru".equals(host))
                    && uri.getPath() != null
                    && uri.getPath().contains(":share");

            if (isMaxShare && isPackageInstalled(MAX_PACKAGE)) {
                intent.setPackage(MAX_PACKAGE);
            }

            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            // Если MAX не принял ссылку — пробуем без привязки к пакету
            try {
                Uri uri = Uri.parse(url);
                Intent fallback = new Intent(Intent.ACTION_VIEW, uri);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception e2) {
                call.reject(e2.getMessage() != null ? e2.getMessage() : "Не удалось открыть ссылку", e2);
            }
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
}
