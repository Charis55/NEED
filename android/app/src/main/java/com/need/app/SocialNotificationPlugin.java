package com.need.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SocialNotification")
public class SocialNotificationPlugin extends Plugin {

    private static android.media.MediaPlayer mediaPlayer;
    private static Vibrator vibrator;
    private static boolean isRingingRequested = false;

    @PluginMethod
    public void startService(PluginCall call) {
        String uid = call.getString("uid");
        if (uid != null) {
            Intent intent = new Intent(getContext(), SocialNotificationService.class);
            intent.putExtra("uid", uid);
            getContext().startService(intent);
            call.resolve();
        } else {
            call.reject("Must provide uid");
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent intent = new Intent(getContext(), SocialNotificationService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void playRingtone(PluginCall call) {
        startRingtoneNative(getContext());
        call.resolve();
    }

    public static void startRingtoneNative(Context context) {
        isRingingRequested = true;
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        
        if (vibrator == null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vibrator = vm.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }
        }

        int ringerMode = am.getRingerMode();

        // If phone is on Normal/Sound mode, play the actual ringtone
        if (ringerMode == AudioManager.RINGER_MODE_NORMAL) {
            try {
                if (mediaPlayer == null) {
                    Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                    if (ringtoneUri == null) {
                        ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    }
                    if (ringtoneUri != null) {
                        mediaPlayer = new android.media.MediaPlayer();
                        mediaPlayer.setDataSource(context, ringtoneUri);
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            mediaPlayer.setAudioAttributes(
                                new android.media.AudioAttributes.Builder()
                                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                    .build()
                            );
                        } else {
                            mediaPlayer.setAudioStreamType(AudioManager.STREAM_RING);
                        }
                        mediaPlayer.setLooping(true);
                        mediaPlayer.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener() {
                            @Override
                            public void onPrepared(android.media.MediaPlayer mp) {
                                if (isRingingRequested) {
                                    try {
                                        mp.start();
                                    } catch (Exception e) {
                                        Log.e("SocialNotification", "Failed to start mp in onPrepared", e);
                                    }
                                } else {
                                    try {
                                        mp.release();
                                    } catch (Exception e) {
                                        Log.e("SocialNotification", "Failed to release mp in onPrepared", e);
                                    }
                                }
                            }
                        });
                        mediaPlayer.prepareAsync();
                    }
                } else if (!mediaPlayer.isPlaying()) {
                    mediaPlayer.start();
                }
            } catch (Exception e) {
                Log.e("SocialNotification", "Failed to play ringtone", e);
            }
        }
        
        // If phone is on Normal OR Vibrate, vibrate the phone
        if (ringerMode == AudioManager.RINGER_MODE_NORMAL || ringerMode == AudioManager.RINGER_MODE_VIBRATE) {
            if (vibrator != null) {
                long[] pattern = {0, 1000, 1000}; // wait 0ms, vibrate 1000ms, wait 1000ms...
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)); // 0 = loop from start
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        }
    }

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        stopRingtoneNative();
        call.resolve();
    }

    public static void stopRingtoneNative() {
        isRingingRequested = false;
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
            } catch (Exception e) {
                Log.e("SocialNotification", "Failed to stop media player", e);
            }
            try {
                mediaPlayer.release();
            } catch (Exception e) {
                Log.e("SocialNotification", "Failed to release media player", e);
            }
            mediaPlayer = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        stopRingtoneNative();
    }
}
