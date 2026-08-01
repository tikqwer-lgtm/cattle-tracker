package com.cattletracker.app;

import android.content.Context;
import android.util.Log;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Synchronous POST /api/reports with mirrored Bearer token.
 */
public final class TelemetryUploader {
    private static final String TAG = "CtTelemetry";
    private static final int CONNECT_MS = 15000;
    private static final int READ_MS = 30000;
    private static final int MAX_RING_CHARS = 120000;

    private TelemetryUploader() {}

    public static final class Result {
        public final boolean ok;
        public final int httpCode;
        public final boolean unauthorized;
        public final String error;

        Result(boolean ok, int httpCode, boolean unauthorized, String error) {
            this.ok = ok;
            this.httpCode = httpCode;
            this.unauthorized = unauthorized;
            this.error = error;
        }
    }

    public static Result upload(Context ctx, String kind, String message) {
        Context app = ctx.getApplicationContext();
        if (!TelemetryConfig.hasUploadConfig(app)) {
            return new Result(false, 0, false, "no upload config");
        }
        String base = TelemetryConfig.getApiBase(app);
        String token = TelemetryConfig.getToken(app);
        String ring = TelemetryRingLog.readTail(app, MAX_RING_CHARS);
        try {
            JSONObject payload = new JSONObject();
            payload.put("kind", kind != null ? kind : "unknown");
            payload.put("platform", "android");
            payload.put("appVersion", TelemetryConfig.getAppVersion(app));
            payload.put("detectedAt", System.currentTimeMillis());
            payload.put("ringLog", ring);

            JSONObject body = new JSONObject();
            String msg = message != null && !message.isEmpty()
                ? message
                : ("Android " + (kind != null ? kind : "telemetry"));
            body.put("message", msg);
            body.put("payload", payload);

            String urlStr = base + "/api/reports";
            HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(CONNECT_MS);
            conn.setReadTimeout(READ_MS);
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Authorization", "Bearer " + token);

            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            OutputStream os = conn.getOutputStream();
            os.write(bytes);
            os.flush();
            os.close();

            int code = conn.getResponseCode();
            InputStream is = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            String resp = readStream(is);
            conn.disconnect();

            if (code >= 200 && code < 300) {
                Log.i(TAG, "upload ok kind=" + kind);
                return new Result(true, code, false, null);
            }
            boolean unauth = code == 401 || code == 403;
            Log.w(TAG, "upload failed code=" + code + " body=" + resp);
            return new Result(false, code, unauth, "HTTP " + code);
        } catch (Exception e) {
            Log.e(TAG, "upload error", e);
            return new Result(false, 0, false, e.getMessage());
        }
    }

    private static String readStream(InputStream is) {
        if (is == null) return "";
        try {
            BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line);
            }
            br.close();
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
