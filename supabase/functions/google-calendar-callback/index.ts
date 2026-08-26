import {
  CALENDAR_SCOPE,
  adminClient,
  exchangeAuthorizationCode,
  googleConfig,
  syncCalendarForUser,
  verifyOAuthState,
} from '../_shared/googleCalendar.ts';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] ?? char));
}

function html(message: string, status = 200): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Google Calendar</title><p>${escapeHtml(message)}</p>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const errorParam = url.searchParams.get('error');
    if (errorParam) return html(`Google 授權未完成：${errorParam}`, 400);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) return html('缺少 Google OAuth callback 參數。', 400);

    const admin = adminClient();
    const cfg = googleConfig();
    const { userId } = await verifyOAuthState(state);
    const tokens = await exchangeAuthorizationCode(code);
    const { data: existing, error: existingError } = await admin
      .from('google_calendar_connections')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) throw existingError;

    const refreshToken = tokens.refresh_token || existing?.refresh_token;
    if (!refreshToken) throw new Error('Google 未回傳 refresh token；請重新授權並允許離線存取。');

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const { error } = await admin.from('google_calendar_connections').upsert({
      user_id: userId,
      calendar_id: 'primary',
      refresh_token: refreshToken,
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
      scope: tokens.scope || CALENDAR_SCOPE,
      updated_at: new Date().toISOString(),
      sync_error: null,
    }, { onConflict: 'user_id' });
    if (error) throw error;

    await syncCalendarForUser(admin, userId);
    const target = new URL(cfg.appReturnUrl);
    target.searchParams.set('calendar', 'connected');
    return Response.redirect(target.toString(), 302);
  } catch (error) {
    console.error('google-calendar-callback error', error);
    return html(`Google Calendar 連線失敗：${error instanceof Error ? error.message : String(error)}`, 500);
  }
});
