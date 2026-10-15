package com.need.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "AudioToggle")
public class AudioTogglePlugin extends Plugin {
    private static final String TAG = "AudioTogglePlugin";
    private static final String ONGOING_CALL_CHANNEL_ID = "ongoing_call_channel_v1";
    private static final int ONGOING_CALL_NOTIFICATION_ID = 1005;

    private void ensureOngoingCallChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                NotificationChannel channel = notificationManager.getNotificationChannel(ONGOING_CALL_CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(
                        ONGOING_CALL_CHANNEL_ID,
                        "Ongoing Calls",
                        NotificationManager.IMPORTANCE_LOW
                    );
                    channel.setDescription("Shows active call status, timer, and controls in the status bar and lock screen");
                    channel.setShowBadge(false);
                    notificationManager.createNotificationChannel(channel);
                }
            }
        }
    }

    @PluginMethod
    public void startOngoingCall(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        String partnerName = call.getString("partnerName", "Need Call");
        boolean isVideo = call.getBoolean("isVideo", false);
        long connectedAt = call.getLong("connectedAt", System.currentTimeMillis());
        boolean isMuted = call.getBoolean("isMuted", false);
        boolean isSpeaker = call.getBoolean("isSpeaker", true);

        try {
            ensureOngoingCallChannel(context);

            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) {
                call.reject("NotificationManager is null");
                return;
            }

            int flagImmutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;

            // 1. Content Intent (Tapping notification reopens the call screen in app)
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setAction(Intent.ACTION_VIEW);
            openIntent.setData(Uri.parse("needapp://call/ongoing"));
            openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context,
                10051,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | flagImmutable
            );

            // 2. End Call Intent
            Intent endIntent = new Intent(context, MainActivity.class);
            endIntent.setAction(Intent.ACTION_VIEW);
            endIntent.setData(Uri.parse("needapp://call/end"));
            endIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent endPendingIntent = PendingIntent.getActivity(
                context,
                10052,
                endIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | flagImmutable
            );

            // 3. Mute/Unmute Intent
            Intent muteIntent = new Intent(context, MainActivity.class);
            muteIntent.setAction(Intent.ACTION_VIEW);
            muteIntent.setData(Uri.parse("needapp://call/toggle-mute"));
            muteIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent mutePendingIntent = PendingIntent.getActivity(
                context,
                10053,
                muteIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | flagImmutable
            );

            // 4. Speaker/Earpiece Intent
            Intent speakerIntent = new Intent(context, MainActivity.class);
            speakerIntent.setAction(Intent.ACTION_VIEW);
            speakerIntent.setData(Uri.parse("needapp://call/toggle-speaker"));
            speakerIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent speakerPendingIntent = PendingIntent.getActivity(
                context,
                10054,
                speakerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | flagImmutable
            );

            Person caller = new Person.Builder()
                .setName(partnerName != null && !partnerName.isEmpty() ? partnerName : "Active Call")
                .setImportant(true)
                .build();

            int iconRes = context.getResources().getIdentifier("ic_stat_icon", "drawable", context.getPackageName());
            if (iconRes == 0) {
                iconRes = android.R.drawable.stat_sys_phone_call;
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ONGOING_CALL_CHANNEL_ID)
                .setSmallIcon(iconRes)
                .setContentTitle(partnerName != null && !partnerName.isEmpty() ? partnerName : "Ongoing Call")
                .setContentText(isVideo ? "Active video call" : "Active voice call")
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setUsesChronometer(true)
                .setWhen(connectedAt > 0 ? connectedAt : System.currentTimeMillis())
                .setShowWhen(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(contentPendingIntent);

            try {
                NotificationCompat.CallStyle callStyle = NotificationCompat.CallStyle.forOngoingCall(caller, endPendingIntent);
                builder.setStyle(callStyle);
            } catch (Throwable t) {
                Log.w(TAG, "NotificationCompat.CallStyle fallback: " + t.getMessage());
                builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Call", endPendingIntent);
            }

            // Add Mute and Speaker quick actions
            builder.addAction(0, isMuted ? "Unmute" : "Mute", mutePendingIntent);
            builder.addAction(0, isSpeaker ? "Earpiece" : "Speaker", speakerPendingIntent);

            notificationManager.notify(ONGOING_CALL_NOTIFICATION_ID, builder.build());

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start ongoing call notification: " + e.getMessage(), e);
            call.reject("Failed to start ongoing call notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopOngoingCall(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        try {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.cancel(ONGOING_CALL_NOTIFICATION_ID);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop ongoing call notification: " + e.getMessage(), e);
            call.reject("Failed to stop ongoing call notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void setAudioMode(PluginCall call) {
        String mode = call.getString("mode", "speaker");
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            call.reject("AudioManager is null");
            return;
        }

        try {
            if ("earpiece".equalsIgnoreCase(mode)) {
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audioManager.setSpeakerphoneOn(false);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    List<AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                    for (AudioDeviceInfo device : devices) {
                        if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                            audioManager.setCommunicationDevice(device);
                            break;
                        }
                    }
                }
                Log.d(TAG, "Audio routed to EARPIECE");

            } else if ("speaker".equalsIgnoreCase(mode)) {
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audioManager.setSpeakerphoneOn(true);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    List<AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                    for (AudioDeviceInfo device : devices) {
                        if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                            audioManager.setCommunicationDevice(device);
                            break;
                        }
                    }
                }
                Log.d(TAG, "Audio routed to SPEAKER");

            } else {
                // Reset to normal mode (call ended)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    audioManager.clearCommunicationDevice();
                }
                audioManager.setSpeakerphoneOn(false);
                audioManager.setMode(AudioManager.MODE_NORMAL);
                Log.d(TAG, "Audio mode reset to NORMAL");
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("mode", mode);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to set audio mode: " + e.getMessage(), e);
            call.reject("Failed to set audio mode: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isSpeakerphoneOn(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            call.reject("AudioManager is null");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("speakerOn", audioManager.isSpeakerphoneOn());
        call.resolve(ret);
    }
}
