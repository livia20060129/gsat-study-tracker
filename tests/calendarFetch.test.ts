import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarSyncWindow, fetchCompleteCalendarEvents } from '../supabase/functions/_shared/calendarFetch.ts';

test('full Calendar sync includes all previously tracked dates and has an exclusive Taipei-day upper bound', () => {
  const window = calendarSyncWindow(Date.parse('2026-11-07T06:00:00Z'), '2026-07-01');
  assert.equal(window.startDate, '2026-07-01');
  assert.equal(window.timeMin, '2026-06-30T16:00:00.000Z');
  assert.equal(window.timeMax, new Date(window.endDate + 'T00:00:00+08:00').toISOString());
  assert.equal(calendarSyncWindow(Date.now()).startDate, '2026-08-10');
});

test('all pages and cancellation IDs are retained before the caller may reconcile deletes', async () => {
  const urls: URL[] = [];
  const fetcher: typeof fetch = async url => {
    const query = new URL(String(url)); urls.push(query);
    return Response.json(urls.length === 1 ? { items: [{ id: 'kept' }], nextPageToken: 'next' }
      : { items: [{ id: 'deleted', status: 'cancelled' }] });
  };
  const result = await fetchCompleteCalendarEvents('private-token', 'primary', '2026-08-01', fetcher);
  assert.equal(result.events.length, 2);
  assert.equal(urls[1].searchParams.get('pageToken'), 'next');
  assert.equal(urls[0].searchParams.get('showDeleted'), 'true');
});

test('HTTP failures, malformed pages and looping cursors never produce a partial authoritative schedule', async () => {
  for (const value of [{}, { items: [{}] }, { items: [], nextPageToken: 12 }]) {
    await assert.rejects(fetchCompleteCalendarEvents('token', 'primary', null, async () => Response.json(value)));
  }
  let calls = 0;
  await assert.rejects(fetchCompleteCalendarEvents('token', 'primary', null, async () => ++calls === 1
    ? Response.json({ items: [{ id: 'first' }], nextPageToken: 'next' }) : new Response('', { status: 503 })));
  await assert.rejects(fetchCompleteCalendarEvents('token', 'primary', null, async () => Response.json({ items: [], nextPageToken: 'same' })), /did not advance/);
});
