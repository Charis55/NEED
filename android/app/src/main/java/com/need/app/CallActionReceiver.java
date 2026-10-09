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
        if ("DECLINE_CALL".equals(action)) {
            String requestId = intent.getStringExtra("requestId");
            
            // 1. Cancel the notification immediately
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.cancel(1001); // Cancel the ringing notification
            
            // 2. Make network request to decline call without opening app
            if (requestId != null) {
                new DeclineCallTask().execute(requestId);
            }
            
            // Collapse the notification panel
            Intent closeIntent = new Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS);
            context.sendBroadcast(closeIntent);
        }
    }

    private static class DeclineCallTask extends AsyncTask<String, Void, Void> {
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

                String jsonInputString = "{\"requestId\": \"" + requestId + "\"}";
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInputString.getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                int code = conn.getResponseCode();
                Log.d("CallActionReceiver", "Decline API Response Code: " + code);
            } catch (Exception e) {
                e.printStackTrace();
            }
            return null;
        }
    }
}
