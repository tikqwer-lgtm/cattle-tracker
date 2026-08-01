package com.cattletracker.app;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * WorkManager upload of pending/hang/crash telemetry to POST /api/reports.
 */
public class TelemetryUploadWorker extends Worker {
    public static final String KEY_KIND = "kind";
    public static final String KEY_MESSAGE = "message";
    private static final String UNIQUE_PENDING = "ct_telemetry_pending";

    public TelemetryUploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        String kind = getInputData().getString(KEY_KIND);
        String message = getInputData().getString(KEY_MESSAGE);
        if (kind == null || kind.isEmpty()) {
            kind = TelemetryConfig.getPendingKind(ctx);
            message = TelemetryConfig.getPendingMessage(ctx);
        }
        if (kind == null || kind.isEmpty()) {
            return Result.success();
        }
        if (!TelemetryConfig.hasUploadConfig(ctx)) {
            TelemetryConfig.setPendingReport(ctx, kind, message != null ? message : "");
            return Result.retry();
        }
        TelemetryUploader.Result r = TelemetryUploader.upload(ctx, kind, message);
        if (r.ok) {
            TelemetryConfig.clearPendingReport(ctx);
            return Result.success();
        }
        if (r.unauthorized) {
            TelemetryConfig.setPendingReport(ctx, kind, message != null ? message : "");
            return Result.failure();
        }
        TelemetryConfig.setPendingReport(ctx, kind, message != null ? message : "");
        return Result.retry();
    }

    public static void enqueue(Context ctx, String kind, String message) {
        Context app = ctx.getApplicationContext();
        TelemetryConfig.setPendingReport(app, kind, message != null ? message : "");
        Data data = new Data.Builder()
            .putString(KEY_KIND, kind)
            .putString(KEY_MESSAGE, message != null ? message : "")
            .build();
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(TelemetryUploadWorker.class)
            .setInputData(data)
            .setConstraints(constraints)
            .build();
        WorkManager.getInstance(app).enqueueUniqueWork(
            UNIQUE_PENDING,
            ExistingWorkPolicy.REPLACE,
            req
        );
    }

    /** Try immediate upload on background thread; fall back to WorkManager. */
    public static void uploadNowOrEnqueue(Context ctx, String kind, String message) {
        Context app = ctx.getApplicationContext();
        new Thread(() -> {
            if (!TelemetryConfig.hasUploadConfig(app)) {
                enqueue(app, kind, message);
                return;
            }
            TelemetryUploader.Result r = TelemetryUploader.upload(app, kind, message);
            if (r.ok) {
                TelemetryConfig.clearPendingReport(app);
                return;
            }
            enqueue(app, kind, message);
        }, "ct-telemetry-upload").start();
    }

    public static void flushPendingIfAny(Context ctx) {
        Context app = ctx.getApplicationContext();
        if (!TelemetryConfig.hasPendingReport(app)) return;
        String kind = TelemetryConfig.getPendingKind(app);
        String message = TelemetryConfig.getPendingMessage(app);
        uploadNowOrEnqueue(app, kind, message);
    }
}
