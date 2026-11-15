import { expect, type Page } from '@playwright/test';

/** Real SDK PKCE flow; only the external authorization page is substituted. */
export async function mockGoogleRedirect(page: Page): Promise<void> {
  await page.route('https://arxbirgujbrtzhoficdf.supabase.co/auth/v1/authorize?*', async route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    const callback = new URL(url.searchParams.get('redirect_to')!);
    expect(callback.origin).toBe(new URL(page.url()).origin);
    expect(callback.searchParams.get('google_auth')).toBe('1');
    callback.searchParams.set('code', 'test-google-code');
    await route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(callback.href)})</script>` });
  });
}
