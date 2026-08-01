package com.cattletracker.app;

import android.content.Context;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Rotating ring log on disk (size-capped). Thread-safe append.
 */
public final class TelemetryRingLog {
    private static final String DIR = "telemetry";
    private static final String FILE = "ring.log";
    private static final long MAX_BYTES = 384L * 1024L;
    private static final Object LOCK = new Object();

    private TelemetryRingLog() {}

    private static File logFile(Context ctx) {
        File dir = new File(ctx.getApplicationContext().getFilesDir(), DIR);
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return new File(dir, FILE);
    }

    public static void append(Context ctx, String line) {
        if (line == null) return;
        String trimmed = line.replace("\r", " ").replace("\n", " ");
        if (trimmed.length() > 2000) {
            trimmed = trimmed.substring(0, 2000) + "…";
        }
        String ts = isoNow();
        String entry = ts + " " + trimmed + "\n";
        synchronized (LOCK) {
            try {
                File f = logFile(ctx);
                if (f.exists() && f.length() > MAX_BYTES) {
                    rotate(f);
                }
                FileOutputStream fos = new FileOutputStream(f, true);
                OutputStreamWriter w = new OutputStreamWriter(fos, StandardCharsets.UTF_8);
                w.write(entry);
                w.flush();
                w.close();
            } catch (Exception ignored) {
            }
        }
    }

    private static void rotate(File f) {
        try {
            long keep = MAX_BYTES / 2;
            if (f.length() <= keep) return;
            FileInputStream fis = new FileInputStream(f);
            long skip = f.length() - keep;
            //noinspection ResultOfMethodCallIgnored
            fis.skip(skip);
            BufferedReader br = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8));
            // Drop partial first line
            br.readLine();
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append('\n');
            }
            br.close();
            FileOutputStream fos = new FileOutputStream(f, false);
            OutputStreamWriter w = new OutputStreamWriter(fos, StandardCharsets.UTF_8);
            w.write(sb.toString());
            w.flush();
            w.close();
        } catch (Exception ignored) {
        }
    }

    /** Tail of log, capped for upload body. */
    public static String readTail(Context ctx, int maxChars) {
        synchronized (LOCK) {
            try {
                File f = logFile(ctx);
                if (!f.exists() || f.length() == 0) return "";
                FileInputStream fis = new FileInputStream(f);
                long len = f.length();
                int max = Math.max(1024, maxChars);
                if (len > max) {
                    //noinspection ResultOfMethodCallIgnored
                    fis.skip(len - max);
                }
                BufferedReader br = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8));
                if (len > max) {
                    br.readLine(); // partial line
                }
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line).append('\n');
                }
                br.close();
                return sb.toString();
            } catch (Exception e) {
                return "";
            }
        }
    }

    private static String isoNow() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        return fmt.format(new Date());
    }
}
