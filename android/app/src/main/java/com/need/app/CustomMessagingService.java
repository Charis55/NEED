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
        if (data != null && "call".equals(data.get("type"))) {
            showCallNotification(data);
        }
    }

    private void showCallNotification(Map<String, String> data) {
        String title = data.get("title");
        if (title == null) title = "Incoming Call";
        
        String body = data.get("body");
        if (body == null) body = "Tap to answer";

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "incoming_calls_v3";

        // Create intent to open the app
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 1001, intent, flags);
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.mipmap.ic_launcher) // Fallback icon
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setOngoing(true)
                .setSound(ringtoneUri)
                .setVibrate(new long[]{0, 1000, 1000, 1000, 1000, 1000, 1000, 1000})
                .setFullScreenIntent(pendingIntent, true)
                .setContentIntent(pendingIntent);

        // Explicitly set ic_stat_icon if available
        int resId = getResources().getIdentifier("ic_stat_icon", "drawable", getPackageName());
        if (resId != 0) {
            builder.setSmallIcon(resId);
        }

        Notification notification = builder.build();
        // FLAG_INSISTENT makes the sound and vibration loop until the notification is cancelled or the tray is opened
        notification.flags |= Notification.FLAG_INSISTENT;

        notificationManager.notify(1001, notification);
    }
}
