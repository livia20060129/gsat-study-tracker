package dev.liviayeh.gsat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Iterator;

/** Private, durable changes only; no notes, login tokens or cloud credentials. */
public final class LockTimerJournal {
    private final JSONObject root;
    public LockTimerJournal(String encoded) throws JSONException {
        root = encoded == null ? new JSONObject() : new JSONObject(encoded);
        if (!root.has("pending")) root.put("pending", new JSONObject());
    }
    public String encode() { return root.toString(); }
    public JSONObject current() { return root.optJSONObject("current"); }
    private static Object stamp(JSONObject state, String key) { return state.isNull(key) ? JSONObject.NULL : state.opt(key); }
    public static boolean pending(JSONObject state) {
        return state.optLong("accumulatedSeconds") != state.optLong("baseAccumulatedSeconds") || !stamp(state, "startedAt").equals(stamp(state, "baseStartedAt"));
    }
    private static void validate(JSONObject state) {
        for (String key : new String[]{"accumulatedSeconds", "baseAccumulatedSeconds"}) {
            double value = state.optDouble(key, -1);
            if (!Double.isFinite(value) || value < 0 || value != Math.floor(value) || value > 9007199254740991d) throw new IllegalArgumentException("Invalid duration");
        }
        for (String key : new String[]{"startedAt", "baseStartedAt"}) {
            if (state.isNull(key)) continue;
            double value = state.optDouble(key, -1);
            if (!Double.isFinite(value) || value <= 0 || value != Math.floor(value) || value > 9007199254740991d) throw new IllegalArgumentException("Invalid anchor");
        }
    }
    private boolean matches(String id, long revision) {
        JSONObject state = current();
        return state == null ? id.isEmpty() && revision == 0 : state.optString("id").equals(id) && state.optLong("revision") == revision;
    }
    public JSONObject envelope(boolean applied) throws JSONException {
        JSONArray pending = new JSONArray(); JSONObject archive = root.getJSONObject("pending");
        for (Iterator<String> keys = archive.keys(); keys.hasNext();) pending.put(archive.getJSONObject(keys.next()));
        if (current() != null && pending(current())) pending.put(current());
        return new JSONObject().put("current", current() == null ? JSONObject.NULL : current()).put("pending", pending).put("applied", applied);
    }
    public JSONObject publish(JSONObject session, String expectedId, long expectedRevision, boolean userAction) throws JSONException {
        if (!matches(expectedId, expectedRevision)) return envelope(false);
        if (!session.optString("id").matches("[A-Za-z0-9-]{1,80}") || !session.optString("scope").matches("study-v11:(guest|user:[^:]+):")
            || !session.optString("date").matches("\\d{4}-\\d{2}-\\d{2}") || session.optString("itemId").isEmpty()) throw new IllegalArgumentException("Invalid identity");
        validate(session); JSONObject previous = current();
        if (previous != null && pending(previous)) {
            if (previous.optString("id").equals(session.optString("id"))) return envelope(false);
            root.getJSONObject("pending").put(previous.getString("id"), previous);
        }
        JSONObject saved = new JSONObject(session.toString());
        saved.put("revision", previous == null ? 1 : previous.optLong("revision") + 1).put("acknowledgedRevision", previous == null ? 1 : previous.optLong("revision") + 1);
        saved.put("baseAccumulatedSeconds", saved.getLong("accumulatedSeconds")).put("baseStartedAt", stamp(saved, "startedAt"));
        root.put("current", saved);
        if (userAction || previous == null || !saved.optString("id").equals(previous.optString("id"))) root.remove("dismissedId");
        return envelope(true);
    }
    public JSONObject acknowledge(String id, long revision, long seconds, Object startedAt, boolean discard) throws JSONException {
        JSONObject current = current(), archive = root.getJSONObject("pending");
        JSONObject state = current != null && current.optString("id").equals(id) ? current : archive.optJSONObject(id);
        if (state == null) return envelope(true);
        if (revision < state.optLong("acknowledgedRevision") || revision > state.optLong("revision") || (discard && revision != state.optLong("revision"))) return envelope(false);
        state.put("baseAccumulatedSeconds", discard ? state.getLong("accumulatedSeconds") : seconds).put("baseStartedAt", discard ? stamp(state, "startedAt") : startedAt).put("acknowledgedRevision", revision);
        validate(state); if (state != current && !pending(state)) archive.remove(id);
        return envelope(true);
    }
    public JSONObject clear(String id, long revision, boolean preserve) throws JSONException {
        if (!matches(id, revision)) return envelope(false);
        JSONObject state = current();
        if (state != null && preserve && pending(state)) root.getJSONObject("pending").put(id, state);
        if (!preserve) root.getJSONObject("pending").remove(id);
        root.remove("current"); root.remove("dismissedId"); return envelope(true);
    }
    public boolean change(String id, long revision, boolean running, long now) throws JSONException {
        if (!matches(id, revision) || current() == null) return false;
        JSONObject state = current(); boolean active = !state.isNull("startedAt");
        if (active == running) return false;
        if (running) state.put("startedAt", now);
        else state.put("accumulatedSeconds", state.getLong("accumulatedSeconds") + Math.max(0, (now - state.getLong("startedAt")) / 1000)).put("startedAt", JSONObject.NULL);
        state.put("revision", revision + 1); return true;
    }
    public void dismiss(String id, long revision) throws JSONException { if (matches(id, revision)) root.put("dismissedId", id); }
    public boolean dismissed() { return current() != null && current().optString("id").equals(root.optString("dismissedId")); }
}
