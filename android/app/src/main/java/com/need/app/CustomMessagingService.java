package com.need.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class CustomMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        if (data == null) return;

        String type = data.get("type");
        if ("call".equals(type)) {
            // When app is in the foreground, the in-app IncomingCallModal displays and rings.
            // Only show the system status-bar notification when the app is backgrounded or closed.
            if (!MainActivity.isAppInForeground) {
                showCallNotification(data);
            }
        } else if ("cancel_call".equals(type)) {
            // The caller cancelled or call was declined/ended — dismiss persistent ringing notification
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancel(1001);
            }
        } else {
            // General notification: chat, job_update, new_request, etc.
            // When the app is in the background or killed, ensure a system notification is posted!
            if (!MainActivity.isAppInForeground) {
                showGeneralNotification(remoteMessage);
            }
        }
    }

    private void showCallNotification(Map<String, String> data) {
        String title = data.get("title");
        if (title == null || title.isEmpty()) title = data.get("callerName");
        if (title == null || title.isEmpty()) title = "Incoming Call";
        
        String body = data.get("body");
        if (body == null || body.isEmpty()) body = "Tap to answer";

        String reqId = data.get("requestId");
        if (reqId == null) reqId = data.get("jobId");

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        String channelId = "incoming_calls_v4";

        Uri ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_RINGTONE);
        if (ringtoneUri == null) {
            ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel callChannel = notificationManager.getNotificationChannel(channelId);
            if (callChannel == null) {
                callChannel = new NotificationChannel(
                    channelId,
                    "Incoming Calls",
                    NotificationManager.IMPORTANCE_HIGH
                );
                callChannel.setDescription("Rings for incoming audio/video calls");
                callChannel.enableVibration(true);
                callChannel.setShowBadge(true);
                
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                        
                callChannel.setSound(ringtoneUri, audioAttributes);
                notificationManager.createNotificationChannel(callChannel);
            }
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Tap notification body -> Open app
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            mainIntent.putExtra(entry.getKey(), entry.getValue());
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 1001, mainIntent, flags);
        
        // Tap "Answer" -> Open app directly with deep link and immediately answer
        String chName = data.get("channelName");
        if (chName == null || chName.isEmpty()) chName = reqId;
        Intent answerIntent = new Intent(this, MainActivity.class);
        answerIntent.setAction("ANSWER_CALL");
        answerIntent.setData(Uri.parse("needapp://call/answer?requestId=" + reqId + "&jobId=" + reqId + "&channelName=" + chName));
        answerIntent.putExtra("action", "answer");
        answerIntent.putExtra("requestId", reqId);
        answerIntent.putExtra("jobId", reqId);
        answerIntent.putExtra("channelName", chName);
        answerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent answerPendingIntent = PendingIntent.getActivity(this, 1002, answerIntent, flags);
        
        // Tap "Decline" -> Background BroadcastReceiver terminates the call and dismisses notification
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction("DECLINE_CALL");
        declineIntent.putExtra("requestId", reqId);
        declineIntent.putExtra("jobId", reqId);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(this, 1003, declineIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setOngoing(true)
                .setSound(ringtoneUri)
                .setVibrate(new long[]{0, 1000, 1000, 1000, 1000, 1000, 1000, 1000})
                .setFullScreenIntent(pendingIntent, true)
                .setContentIntent(pendingIntent)
                .addAction(0, "Decline", declinePendingIntent)
                .addAction(0, "Answer", answerPendingIntent);

        // Explicitly set ic_stat_icon if available
        int resId = getResources().getIdentifier("ic_stat_icon", "drawable", getPackageName());
        if (resId != 0) {
            builder.setSmallIcon(resId);
        }

        Notification notification = builder.build();
        // FLAG_INSISTENT makes the sound and vibration loop until answered, declined, or cancelled
        notification.flags |= Notification.FLAG_INSISTENT;

        notificationManager.notify(1001, notification);
    }

    private void showGeneralNotification(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String title = null;
        String body = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }
        if ((title == null || title.isEmpty()) && data != null) {
            title = data.get("title");
        }
        if (title == null || title.isEmpty()) {
            title = "Need";
        }
        if ((body == null || body.isEmpty()) && data != null) {
            body = data.get("body");
        }
        if (body == null || body.isEmpty()) {
            body = "You have a new update";
        }

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) return;

        String channelId = "high_priority_alerts";

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        String reqId = data != null ? data.get("requestId") : null;
        if (reqId == null && data != null) reqId = data.get("jobId");
        if (reqId != null && !reqId.isEmpty()) {
            intent.setData(Uri.parse("needapp://chat/" + reqId));
            intent.putExtra("requestId", reqId);
            intent.putExtra("jobId", reqId);
        }

        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        int notifId = (int) (System.currentTimeMillis() % 100000);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, notifId, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

        int resId = getResources().getIdentifier("ic_stat_icon", "drawable", getPackageName());
        if (resId != 0) {
            builder.setSmallIcon(resId);
        }

        notificationManager.notify(notifId, builder.build());
    }
}
