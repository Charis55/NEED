package com.need.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SocialNotification")
public class SocialNotificationPlugin extends Plugin {

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
}
