package com.need.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.AsyncTask;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        
        // Cancel the notification immediately for any call action
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        notificationManager.cancel(1001);

        if ("DECLINE_CALL".equals(action)) {
            String requestId = intent.getStringExtra("requestId");
            
            // Make network request to decline call without opening app
            if (requestId != null) {
                final PendingResult pendingResult = goAsync();
                new DeclineCallTask(pendingResult).execute(requestId);
            }
            
            // Collapse the notification panel
            Intent closeIntent = new Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS);
            context.sendBroadcast(closeIntent);
            
        } else if ("CANCEL_CALL_NOTIFICATION".equals(action)) {
            // Caller cancelled the call — notification already cancelled above, nothing else needed
            Log.d("CallActionReceiver", "Cancelled call notification dismissed");
        }
    }

    private static class DeclineCallTask extends AsyncTask<String, Void, Void> {
        private final PendingResult pendingResult;

        public DeclineCallTask(PendingResult pendingResult) {
            this.pendingResult = pendingResult;
        }

        @Override
        protected Void doInBackground(String... params) {
            String requestId = params[0];
            try {
                // Use the production URL of the app
                URL url = new URL("https://need-chi.vercel.app/api/calls/decline");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                String jsonInputString = "{\"requestId\": \"" + requestId + "\"}";
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int code = conn.getResponseCode();
                Log.d("CallActionReceiver", "Decline API Response Code: " + code);
                conn.disconnect();
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                if (pendingResult != null) {
                    pendingResult.finish();
                }
            }
            return null;
        }
    }
}
