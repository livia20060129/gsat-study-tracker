package dev.liviayeh.gsat;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.content.pm.PackageManager;
import org.json.JSONObject;
import java.util.Locale;

final class StudyLockTimerStore {
    static final String CHANGED = "dev.liviayeh.gsat.LOCK_TIMER_CHANGED";
    private static final String CHANNEL = "gsat-study-timer";
    private static final int NOTIFICATION = 193;
    interface Operation { JSONObject run(LockTimerJournal journal) throws Exception; }
    static synchronized JSONObject read(Context context) throws Exception { return status(context, journal(context).envelope(true)); }
    static synchronized JSONObject edit(Context context, Operation operation) throws Exception {
        LockTimerJournal journal = journal(context); JSONObject result = operation.run(journal);
        if (!context.getSharedPreferences("gsat-lock-timer", Context.MODE_PRIVATE).edit().putString("journal", journal.encode()).commit()) throw new IllegalStateException("Cannot preserve timer");
        present(context, journal); return status(context, result);
    }
    private static LockTimerJournal journal(Context context) throws Exception { return new LockTimerJournal(context.getSharedPreferences("gsat-lock-timer", Context.MODE_PRIVATE).getString("journal", null)); }
    static boolean allowed(Context context) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return false;
        NotificationChannel channel = Build.VERSION.SDK_INT >= 26 ? manager.getNotificationChannel(CHANNEL) : null;
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }
    private static JSONObject status(Context context, JSONObject result) throws Exception { return result.put("available", allowed(context)).put("reason", allowed(context) ? "" : "notifications-denied"); }
    private static PendingIntent action(Context context, JSONObject session, String action) throws Exception {
        Intent intent = new Intent(context, StudyLockTimerReceiver.class).setAction(action)
            .setData(Uri.parse("gsat-lock-timer://" + session.getString("id") + "/" + session.getLong("revision") + "/" + action))
            .putExtra("id", session.getString("id")).putExtra("revision", session.getLong("revision"));
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static void present(Context context, LockTimerJournal journal) throws Exception {
        NotificationManager manager = context.getSystemService(NotificationManager.class); JSONObject session = journal.current();
        if (session == null || journal.dismissed() || !allowed(context)) { manager.cancel(NOTIFICATION); return; }
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "讀書計時", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("鎖定畫面顯示讀書項目與計時，可暫停及繼續。"); channel.setSound(null, null); channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC); manager.createNotificationChannel(channel);
        }
        boolean running = !session.isNull("startedAt"); long seconds = session.getLong("accumulatedSeconds");
        Intent open = new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse("gsattracker://timer/open?sessionId=" + session.getString("id"))).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        builder.setSmallIcon(R.drawable.ic_study_timer).setContentTitle(session.getString("title"))
            .setContentText(running ? "計時中" : "已暫停 · " + String.format(Locale.ROOT, "%02d:%02d", seconds / 60, seconds % 60)).setSubText(session.getString("date"))
            .setCategory(Notification.CATEGORY_PROGRESS).setVisibility(Notification.VISIBILITY_PUBLIC).setOngoing(true).setOnlyAlertOnce(true)
            .setContentIntent(PendingIntent.getActivity(context, 193, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)).setDeleteIntent(action(context, session, "dismiss"))
            .addAction(new Notification.Action.Builder(running ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, running ? "暫停" : "繼續", action(context, session, running ? "pause" : "resume")).build());
        if (running) builder.setWhen(session.getLong("startedAt") - seconds * 1000).setShowWhen(true).setUsesChronometer(true);
        else builder.setShowWhen(false).setUsesChronometer(false);
        manager.notify(NOTIFICATION, builder.build());
    }
}
