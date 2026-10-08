package com.need.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.ListenerRegistration;

import java.util.Map;

public class SocialNotificationService extends Service {
    private static final String TAG = "SocialNotificationSvc";
    private ListenerRegistration artisanListener;
    private ListenerRegistration customerListener;
    private String currentUid;
    private boolean isCurrentlyRinging = false;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String uid = intent != null ? intent.getStringExtra("uid") : null;
        if (uid != null) {
            currentUid = uid;
            Log.d(TAG, "Service started for user: " + uid);
            startForegroundService();
            listenToCalls(uid);
        }
        return START_STICKY;
    }

    private void startForegroundService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "social_service_channel",
                    "Background Call Service",
                    NotificationManager.IMPORTANCE_MIN
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);

            Notification notification = new NotificationCompat.Builder(this, "social_service_channel")
                    .setContentTitle("Need is running")
                    .setContentText("Listening for incoming calls")
                    .setSmallIcon(R.drawable.ic_stat_icon)
                    .build();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(1002, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(1002, notification);
            }
        }
    }

    private void listenToCalls(String uid) {
        FirebaseFirestore db = FirebaseFirestore.getInstance();

        com.google.firebase.firestore.EventListener<com.google.firebase.firestore.QuerySnapshot> listener = (value, error) -> {
            if (error != null) {
                Log.e(TAG, "Listen failed.", error);
                return;
            }

            boolean shouldRing = false;

            if (value != null) {
                for (DocumentSnapshot doc : value.getDocuments()) {
                    Map<String, Object> activeCall = (Map<String, Object>) doc.get("activeCall");
                    if (activeCall != null) {
                        String status = (String) activeCall.get("status");
                        String callerId = (String) activeCall.get("callerId");
                        if ("ringing".equals(status) && !uid.equals(callerId)) {
                            shouldRing = true;
                            break;
                        }
                    }
                }
            }

            if (shouldRing && !isCurrentlyRinging) {
                isCurrentlyRinging = true;
                SocialNotificationPlugin.startRingtoneNative(getApplicationContext());
                showCallNotification();
            } else if (!shouldRing && isCurrentlyRinging) {
                isCurrentlyRinging = false;
                SocialNotificationPlugin.stopRingtoneNative();
                hideCallNotification();
            }
        };

        if (artisanListener != null) artisanListener.remove();
        if (customerListener != null) customerListener.remove();

        artisanListener = db.collection("jobRequests")
                .whereEqualTo("artisanId", uid)
                .addSnapshotListener(listener);

        customerListener = db.collection("jobRequests")
                .whereEqualTo("customerId", uid)
                .addSnapshotListener(listener);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Service destroyed");
        if (artisanListener != null) artisanListener.remove();
        if (customerListener != null) customerListener.remove();
        SocialNotificationPlugin.stopRingtoneNative();
        hideCallNotification();
    }

    private void showCallNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "incoming_calls_native",
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
            );
            manager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, "incoming_calls_native")
                .setContentTitle("Incoming Call")
                .setContentText("Tap to answer")
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true)
                .setAutoCancel(true)
                .setOngoing(true)
                .build();

        manager.notify(2001, notification);
    }

    private void hideCallNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(2001);
        }
    }
}
