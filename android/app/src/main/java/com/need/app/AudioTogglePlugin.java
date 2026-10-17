package com.need.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
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

import android.os.PowerManager;
import java.util.List;

@CapacitorPlugin(name = "AudioToggle")
public class AudioTogglePlugin extends Plugin {
    private static final String TAG = "AudioTogglePlugin";
    private static final String ONGOING_CALL_CHANNEL_ID = "ongoing_call_channel_v1";
    private static final int ONGOING_CALL_NOTIFICATION_ID = 1005;
    private AudioFocusRequest audioFocusRequest;
    private PowerManager.WakeLock proximityWakeLock;

    private void acquireProximityWakeLock(Context context) {
        try {
            if (proximityWakeLock == null) {
                PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (powerManager != null && powerManager.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) {
                    proximityWakeLock = powerManager.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "NeedApp:ProximityScreenLock");
                }
            }
            if (proximityWakeLock != null && !proximityWakeLock.isHeld()) {
                proximityWakeLock.acquire();
                Log.d(TAG, "Proximity wake lock acquired (screen dims near ear)");
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to acquire proximity wake lock: " + t.getMessage());
        }
    }

    private void releaseProximityWakeLock() {
        try {
            if (proximityWakeLock != null && proximityWakeLock.isHeld()) {
                proximityWakeLock.release();
                Log.d(TAG, "Proximity wake lock released");
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to release proximity wake lock: " + t.getMessage());
        }
    }

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
            releaseProximityWakeLock();
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
                // 1. Request Voice Communication Audio Focus so WebView audio is treated as phone call
                requestCallAudioFocus(audioManager);

                // 2. Set telephony communication mode
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audioManager.setSpeakerphoneOn(false);

                // 3. On Android S+ (API 31+), route communication audio to the built-in earpiece
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    List<AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                    AudioDeviceInfo earpieceDevice = null;
                    for (AudioDeviceInfo device : devices) {
                        if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                            earpieceDevice = device;
                            break;
                        }
                    }
                    if (earpieceDevice != null) {
                        boolean ok = audioManager.setCommunicationDevice(earpieceDevice);
                        Log.d(TAG, "setCommunicationDevice to EARPIECE result: " + ok);
                    } else {
                        Log.w(TAG, "No TYPE_BUILTIN_EARPIECE found, clearing communication device");
                        audioManager.clearCommunicationDevice();
                    }
                }

                // 4. Engage hardware proximity sensor to dim screen when phone is held to ear
                acquireProximityWakeLock(context);
                Log.d(TAG, "Audio routed to EARPIECE with proximity screen dimming enabled");

            } else if ("speaker".equalsIgnoreCase(mode)) {
                // 1. Release proximity wake lock so screen remains on for loudspeaker
                releaseProximityWakeLock();

                // 2. Request Voice Communication Audio Focus
                requestCallAudioFocus(audioManager);

                // 3. Set telephony communication mode and speakerphone
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audioManager.setSpeakerphoneOn(true);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    List<AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                    AudioDeviceInfo speakerDevice = null;
                    for (AudioDeviceInfo device : devices) {
                        if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                            speakerDevice = device;
                            break;
                        }
                    }
                    if (speakerDevice != null) {
                        boolean ok = audioManager.setCommunicationDevice(speakerDevice);
                        Log.d(TAG, "setCommunicationDevice to SPEAKER result: " + ok);
                    }
                }
                Log.d(TAG, "Audio routed to SPEAKER");

            } else {
                // Reset to normal mode (call ended)
                releaseProximityWakeLock();
                abandonCallAudioFocus(audioManager);

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

    private void requestCallAudioFocus(AudioManager audioManager) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (audioFocusRequest == null) {
                    AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build();
                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(playbackAttributes)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener(focusChange -> {
                            Log.d(TAG, "Call audio focus changed: " + focusChange);
                        })
                        .build();
                }
                audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                audioManager.requestAudioFocus(null, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to request call audio focus: " + t.getMessage());
        }
    }

    private void abandonCallAudioFocus(AudioManager audioManager) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest);
                    audioFocusRequest = null;
                }
            } else {
                audioManager.abandonAudioFocus(null);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to abandon call audio focus: " + t.getMessage());
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
