package dev.liviayeh.gsat;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public final class StudyLockTimerReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        String action = intent.getAction(); if (action == null) return;
        try {
            StudyLockTimerStore.edit(context, journal -> {
                String id = intent.getStringExtra("id"); long revision = intent.getLongExtra("revision", -1);
                if (id == null) return journal.envelope(false);
                if (action.equals("dismiss")) journal.dismiss(id, revision);
                else if (action.equals("pause") || action.equals("resume")) journal.change(id, revision, action.equals("resume"), System.currentTimeMillis());
                return journal.envelope(true);
            });
            context.sendBroadcast(new Intent(StudyLockTimerStore.CHANGED).setPackage(context.getPackageName()));
        } catch (Exception ignored) { /* Keep the original timer if durable storage failed. */ }
    }
}
