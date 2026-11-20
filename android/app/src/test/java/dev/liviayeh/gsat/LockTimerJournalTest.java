package dev.liviayeh.gsat;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class LockTimerJournalTest {
    private JSONObject session(String id, String scope) throws Exception {
        return new JSONObject().put("id", id).put("scope", scope).put("date", "2026-11-18").put("itemId", "math")
            .put("title", "三角函數").put("accumulatedSeconds", 120).put("startedAt", 100000)
            .put("baseAccumulatedSeconds", 120).put("baseStartedAt", 100000);
    }
    private LockTimerJournal started() throws Exception {
        LockTimerJournal j = new LockTimerJournal(null); j.publish(session("one", "study-v11:guest:"), "", 0, true); return j;
    }
    @Test public void pauseSurvivesProcessRestartAndResumePreservesElapsedTime() throws Exception {
        LockTimerJournal j = started(); assertTrue(j.change("one", 1, false, 165000));
        j = new LockTimerJournal(j.encode()); assertEquals(185, j.current().getLong("accumulatedSeconds"));
        assertTrue(j.current().isNull("startedAt")); assertEquals(1, j.envelope(true).getJSONArray("pending").length());
        assertTrue(j.change("one", 2, true, 200000)); assertTrue(j.change("one", 3, false, 220000));
        assertEquals(205, j.current().getLong("accumulatedSeconds"));
    }
    @Test public void repeatedOldButtonsAndAnotherSessionCannotModifyTheCurrentTimer() throws Exception {
        LockTimerJournal j = started(); assertTrue(j.change("one", 1, false, 165000));
        assertFalse(j.change("one", 1, true, 200000)); assertFalse(j.change("other", 2, true, 200000));
        assertEquals(185, j.current().getLong("accumulatedSeconds"));
    }
    @Test public void pendingLockChangesCannotBeOverwrittenByAStaleWebPublication() throws Exception {
        LockTimerJournal j = started(); j.change("one", 1, false, 165000);
        assertFalse(j.publish(session("one", "study-v11:guest:"), "one", 2, false).getBoolean("applied"));
        assertTrue(j.current().isNull("startedAt"));
    }
    @Test public void acknowledgementRacingANewerActionKeepsTheNewerActionPending() throws Exception {
        LockTimerJournal j = started(); j.change("one", 1, false, 165000); j.change("one", 2, true, 200000);
        j.acknowledge("one", 2, 185, JSONObject.NULL, false);
        assertEquals(3, j.current().getLong("revision")); assertTrue(LockTimerJournal.pending(j.current()));
        assertEquals(185, j.current().getLong("baseAccumulatedSeconds")); assertTrue(j.current().isNull("baseStartedAt"));
        j.acknowledge("one", 3, 185, 200000L, false); assertFalse(LockTimerJournal.pending(j.current()));
    }
    @Test public void accountChangesPreserveUnacknowledgedWorkWithoutKeepingItsNotificationActive() throws Exception {
        LockTimerJournal j = started(); j.change("one", 1, false, 165000); j.clear("one", 2, true);
        assertNull(j.current()); assertEquals(1, j.envelope(true).getJSONArray("pending").length());
        j.publish(session("two", "study-v11:user:another:"), "", 0, true);
        j.acknowledge("one", 2, 185, JSONObject.NULL, false);
        assertEquals("two", j.current().getString("id")); assertEquals(0, j.envelope(true).getJSONArray("pending").length());
    }
    @Test public void obsoleteEndCannotRemoveANewlyChangedSessionAndDismissalDoesNotStopTime() throws Exception {
        LockTimerJournal j = started(); j.change("one", 1, false, 165000);
        assertFalse(j.clear("one", 1, false).getBoolean("applied")); j.dismiss("one", 2);
        assertTrue(j.dismissed()); assertEquals(185, j.current().getLong("accumulatedSeconds"));
    }
    @Test public void invalidPayloadCannotReplaceExistingWork() throws Exception {
        LockTimerJournal j = started(); String before = j.encode();
        try { j.publish(session("bad", "other-site:").put("accumulatedSeconds", -1), "one", 1, true); fail(); }
        catch (IllegalArgumentException expected) { assertEquals(before, j.encode()); }
    }
}
