import {
  CORS_HEADERS,
  adminClient,
  authenticatedUser,
  buildGoogleAuthorizationUrl,
  createOAuthState,
  json,
  syncCalendarForUser,
} from '../_shared/googleCalendar.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const admin = adminClient();
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'status');

    if (action === 'sync-all') {
      const expected = Deno.env.get('CALENDAR_CRON_SECRET') ?? '';
      const provided = req.headers.get('x-cron-secret') ?? '';
      if (!expected || provided !== expected) return json({ error: 'Unauthorized cron request' }, 401);
      const { data: connections, error } = await admin
        .from('google_calendar_connections')
        .select('user_id');
      if (error) throw error;
      const results = [];
      for (const connection of connections ?? []) {
        try {
          results.push({ userId: connection.user_id, ...(await syncCalendarForUser(admin, connection.user_id)) });
        } catch (error) {
          results.push({ userId: connection.user_id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return json({ ok: true, results });
    }

    const userId = await authenticatedUser(req, admin);

    if (action === 'auth-url') {
      const state = await createOAuthState(userId);
      return json({ url: buildGoogleAuthorizationUrl(state) });
    }

    if (action === 'status') {
      const { data, error } = await admin
        .from('google_calendar_connections')
        .select('calendar_id,last_synced_at,sync_error')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return json({ connected: Boolean(data), ...(data ?? {}) });
    }

    if (action === 'sync') {
      return json(await syncCalendarForUser(admin, userId));
    }

    if (action === 'disconnect') {
      const { error: taskError } = await admin.from('calendar_tasks').delete().eq('user_id', userId);
      if (taskError) throw taskError;
      const { error } = await admin.from('google_calendar_connections').delete().eq('user_id', userId);
      if (error) throw error;
      return json({ disconnected: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
