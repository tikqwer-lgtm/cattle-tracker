package com.cattletracker.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS bridge: mirror API credentials, append ring log, flush pending reports.
 */
@CapacitorPlugin(name = "TelemetryBridge")
public class TelemetryBridgePlugin extends Plugin {

    @PluginMethod
    public void setUploadConfig(PluginCall call) {
        String apiBase = call.getString("apiBase");
        String token = call.getString("token");
        TelemetryConfig.setUploadConfig(getContext(), apiBase, token);
        TelemetryRingLog.append(getContext(), "config: upload credentials updated");
        TelemetryUploadWorker.flushPendingIfAny(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clearUploadConfig(PluginCall call) {
        TelemetryConfig.clearUploadConfig(getContext());
        TelemetryRingLog.append(getContext(), "config: upload credentials cleared");
        call.resolve();
    }

    @PluginMethod
    public void appendLog(PluginCall call) {
        String line = call.getString("line");
        if (line == null || line.isEmpty()) {
            call.resolve();
            return;
        }
        TelemetryRingLog.append(getContext(), line);
        call.resolve();
    }

    @PluginMethod
    public void flushPending(PluginCall call) {
        TelemetryUploadWorker.flushPendingIfAny(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject o = new JSObject();
        o.put("hasConfig", TelemetryConfig.hasUploadConfig(getContext()));
        o.put("hasPending", TelemetryConfig.hasPendingReport(getContext()));
        o.put("appVersion", TelemetryConfig.getAppVersion(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void getUploadConfig(PluginCall call) {
        JSObject o = new JSObject();
        String apiBase = TelemetryConfig.getApiBase(getContext());
        String token = TelemetryConfig.getToken(getContext());
        o.put("apiBase", apiBase != null ? apiBase : "");
        o.put("token", token != null ? token : "");
        call.resolve(o);
    }
}
