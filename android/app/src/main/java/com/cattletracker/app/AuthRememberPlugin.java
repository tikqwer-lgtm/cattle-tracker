package com.cattletracker.app;

import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Логин/пароль в SharedPreferences — переживают обновление APK (WebView localStorage часто сбрасывается).
 */
@CapacitorPlugin(name = "AuthRemember")
public class AuthRememberPlugin extends Plugin {
    private static final String PREFS = "cattle_tracker_auth";
    private static final String KEY_PAYLOAD = "payload";

    private SharedPreferences prefs() {
        return getContext().getApplicationContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void get(PluginCall call) {
        JSObject o = new JSObject();
        String payload = prefs().getString(KEY_PAYLOAD, "");
        o.put("payload", payload != null ? payload : "");
        call.resolve(o);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String payload = call.getString("payload");
        prefs().edit().putString(KEY_PAYLOAD, payload != null ? payload : "").apply();
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        prefs().edit().remove(KEY_PAYLOAD).apply();
        call.resolve();
    }
}
