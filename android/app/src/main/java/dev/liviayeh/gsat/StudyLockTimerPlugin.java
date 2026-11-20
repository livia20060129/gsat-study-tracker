package dev.liviayeh.gsat;
import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;

@CapacitorPlugin(name = "StudyLockTimer", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public final class StudyLockTimerPlugin extends Plugin {
    private BroadcastReceiver changes;
    @Override public void load() {
        changes = new BroadcastReceiver() { @Override public void onReceive(Context context, Intent intent) { notifyListeners("timerChanged", new JSObject()); } };
        ContextCompat.registerReceiver(getContext(), changes, new IntentFilter(StudyLockTimerStore.CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED);
    }
    @Override protected void handleOnDestroy() { if (changes != null) getContext().unregisterReceiver(changes); }
    @PluginMethod public void getState(PluginCall call) { try { call.resolve(JSObject.fromJSONObject(StudyLockTimerStore.read(getContext()))); } catch (Exception error) { call.reject("無法讀取裝置計時", error); } }
    @PluginMethod public void publish(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && call.getBoolean("allowPrompt", false) && getPermissionState("notifications") == PermissionState.PROMPT) { requestPermissionForAlias("notifications", call, "notificationPermission"); return; }
        save(call);
    }
    @PermissionCallback private void notificationPermission(PluginCall call) { save(call); }
    private void save(PluginCall call) {
        try {
            JSONObject session = call.getObject("session"); if (session == null) { call.reject("Missing timer"); return; }
            call.resolve(JSObject.fromJSONObject(StudyLockTimerStore.edit(getContext(), journal -> journal.publish(session, call.getString("expectedId", ""), call.getLong("expectedRevision", 0L), call.getBoolean("allowPrompt", false)))));
        } catch (Exception error) { call.reject("無法保存鎖定畫面計時", error); }
    }
    @PluginMethod public void acknowledge(PluginCall call) {
        try { call.resolve(JSObject.fromJSONObject(StudyLockTimerStore.edit(getContext(), journal -> journal.acknowledge(call.getString("id", ""), call.getLong("revision", -1L), call.getLong("accumulatedSeconds", 0L), call.getData().isNull("startedAt") ? JSONObject.NULL : call.getLong("startedAt"), call.getBoolean("discard", false))))); }
        catch (Exception error) { call.reject("計時尚未確認", error); }
    }
    @PluginMethod public void clear(PluginCall call) {
        try { call.resolve(JSObject.fromJSONObject(StudyLockTimerStore.edit(getContext(), journal -> journal.clear(call.getString("id", ""), call.getLong("revision", -1L), call.getBoolean("preserve", false))))); }
        catch (Exception error) { call.reject("無法結束鎖定畫面計時", error); }
    }
}
