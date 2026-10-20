package com.need.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.util.PermissionHelper;
import com.google.firebase.firestore.FirebaseFirestore;

public class MainActivity extends BridgeActivity {

    public static volatile boolean isAppInForeground = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom native plugins before super.onCreate or in onCreate
        registerPlugin(AudioTogglePlugin.class);
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        handleCallIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        isAppInForeground = true;

        // Dismiss persistent incoming call notification when app is open and visible
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(1001);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        isAppInForeground = false;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        // Forward warm-start deep links to Capacitor bridge
        if (this.bridge != null) {
            this.bridge.onNewIntent(intent);
        }

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(1001);
        }

        handleCallIntent(intent);
    }

    private void handleCallIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String reqId = intent.getStringExtra("requestId");
        if (reqId == null) reqId = intent.getStringExtra("jobId");

        Uri data = intent.getData();
        boolean isAnswer = "ANSWER_CALL".equals(action) || 
                           "answer".equals(intent.getStringExtra("action")) ||
                           (data != null && data.toString().contains("call/answer"));

        if (isAnswer) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.cancel(1001);
            }
            if (reqId == null && data != null) {
                reqId = data.getQueryParameter("requestId");
                if (reqId == null) reqId = data.getQueryParameter("jobId");
            }
            if (reqId != null && !reqId.isEmpty()) {
                final String targetRequestId = reqId;
                Log.d("MainActivity", "Native instant answer for requestId: " + targetRequestId);
                try {
                    FirebaseFirestore db = FirebaseFirestore.getInstance();
                    db.collection("jobRequests").document(targetRequestId)
                        .update(
                            "activeCall.status", "ongoing",
                            "activeCall.acceptedByPlatform", "android",
                            "activeCall.connectedAt", System.currentTimeMillis()
                        )
                        .addOnSuccessListener(aVoid -> Log.d("MainActivity", "Native answer Firestore update succeeded"))
                        .addOnFailureListener(e -> Log.w("MainActivity", "Native answer Firestore update failed: " + e.getMessage()));
                } catch (Exception e) {
                    Log.w("MainActivity", "Native answer Firestore error: " + e.getMessage());
                }
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "default",
                "General Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Job requests, updates, and messages");
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);

                NotificationChannel alertChannel = new NotificationChannel(
                    "high_priority_alerts",
                    "High Priority Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                );
                alertChannel.setDescription("Important updates and chat messages");
                alertChannel.enableVibration(true);
                alertChannel.setShowBadge(true);
                manager.createNotificationChannel(alertChannel);

                // Create the channel for incoming calls with the user's actual device ringtone
                NotificationChannel callChannel = new NotificationChannel(
                    "incoming_calls_v4",
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
                );
                callChannel.setDescription("Rings for incoming audio/video calls");
                callChannel.enableVibration(true);
                callChannel.setShowBadge(true);
                
                Uri ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_RINGTONE);
                if (ringtoneUri == null) {
                    ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                        
                callChannel.setSound(ringtoneUri, audioAttributes);
                
                manager.createNotificationChannel(callChannel);
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
                @Override
                public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                    final String[] geoPermissions = {
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.ACCESS_FINE_LOCATION
                    };

                    if (PermissionHelper.hasPermissions(bridge.getContext(), geoPermissions)) {
                        // Retain = true caches origin location permission, preventing main-thread event loops.
                        callback.invoke(origin, true, true);
                    } else {
                        super.onGeolocationPermissionsShowPrompt(origin, callback);
                    }
                }
            });
        }
    }
}
