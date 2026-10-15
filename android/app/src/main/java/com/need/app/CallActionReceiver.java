package com.need.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.google.firebase.firestore.FirebaseFirestore;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class CallActionReceiver extends BroadcastReceiver {
    private static final String TAG = "CallActionReceiver";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        
        // Immediately dismiss persistent notification
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(1001);
        }

        if ("DECLINE_CALL".equals(action)) {
            String requestId = intent.getStringExtra("requestId");
            if (requestId == null) {
                requestId = intent.getStringExtra("jobId");
            }
            
            Log.d(TAG, "DECLINE_CALL received for requestId: " + requestId);

            if (requestId != null && !requestId.isEmpty()) {
                final PendingResult pendingResult = goAsync();
                final String targetRequestId = requestId;

                // 1. Directly update Firestore natively in <50ms so the caller's ringing ends immediately
                try {
                    FirebaseFirestore db = FirebaseFirestore.getInstance();
                    db.collection("jobRequests").document(targetRequestId)
                        .update(
                            "activeCall.status", "ended",
                            "activeCall.endedAt", System.currentTimeMillis(),
                            "activeCall.endedReason", "declined",
                            "lastMessageAt", System.currentTimeMillis()
                        )
                        .addOnSuccessListener(aVoid -> Log.d(TAG, "Native Firestore decline update succeeded for " + targetRequestId))
                        .addOnFailureListener(e -> Log.w(TAG, "Native Firestore direct update failed: " + e.getMessage()));
                } catch (Exception fe) {
                    Log.w(TAG, "Exception initializing native Firestore: " + fe.getMessage());
                }

                // 2. Also send server requests to log chat message and trigger silent push
                executor.execute(() -> {
                    try {
                        sendDeclineRequest(targetRequestId);
                    } catch (Exception e) {
                        Log.e(TAG, "Exception while sending decline request", e);
                    } finally {
                        if (pendingResult != null) {
                            pendingResult.finish();
                        }
                    }
                });
            }
            
            // Attempt to collapse notification shade
            try {
                Intent closeIntent = new Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS);
                context.sendBroadcast(closeIntent);
            } catch (Exception e) {
                // Ignore security exception on newer Android versions
            }

        } else if ("CANCEL_CALL_NOTIFICATION".equals(action)) {
            Log.d(TAG, "Call notification cancelled");
        }
    }

    private void sendDeclineRequest(String requestId) {
        // Try the dedicated decline endpoint first
        boolean success = postJson("https://need-chi.vercel.app/api/calls/decline", requestId);
        
        // If decline endpoint failed, fallback to end call endpoint
        if (!success) {
            Log.w(TAG, "Decline endpoint unsuccessful, trying fallback to /api/calls/end");
            postJson("https://need-chi.vercel.app/api/calls/end", requestId);
        }
    }

    private boolean postJson(String endpointUrl, String requestId) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(endpointUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("User-Agent", "NeedApp-Android/1.0");
            conn.setDoOutput(true);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            String jsonInputString = "{\"requestId\":\"" + requestId + "\",\"jobId\":\"" + requestId + "\",\"reason\":\"declined\"}";
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            Log.d(TAG, "POST " + endpointUrl + " -> Response Code: " + responseCode);

            // Read response stream to prevent connection reset
            InputStream is = (responseCode >= 200 && responseCode < 400) ? conn.getInputStream() : conn.getErrorStream();
            if (is != null) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();
                Log.d(TAG, "Response: " + response.toString());
            }

            return responseCode >= 200 && responseCode < 300;
        } catch (Exception e) {
            Log.e(TAG, "Failed request to " + endpointUrl + ": " + e.getMessage());
            return false;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
