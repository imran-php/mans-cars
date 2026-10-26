import test from 'node:test';
import assert from 'node:assert/strict';
import { availability, applyChange, overlaps, validDate, validateRange, saveChange } from '../netlify/functions/_shared/booking.mjs';
test('unknown calendars never claim a car is free', () => {
  assert.equal(availability(null, '2030-01-01', '2030-01-03').status, 'unknown');
  assert.equal(availability({ initialized: false, bookings: [] }, '2030-01-01', '2030-01-03').status, 'unknown');
});
test('inclusive date bounds and cancelled reservations', () => {
  const calendar = { initialized: true, bookings: [{ start: '2030-01-03', end: '2030-01-05', status: 'confirmed', privateField: 'never public' }] };
  assert.equal(availability(calendar, '2030-01-01', '2030-01-03').status, 'booked');
  assert.equal(availability(calendar, '2030-01-05', '2030-01-05').status, 'booked');
  assert.equal(availability(calendar, '2030-01-06', '2030-01-08').status, 'free');
  assert.deepEqual(availability(calendar, '2030-01-01', '2030-01-03').periods, [{ start: '2030-01-03', end: '2030-01-05' }]);
  calendar.bookings[0].status = 'cancelled';
  assert.equal(availability(calendar, '2030-01-03', '2030-01-05').status, 'free');
});
test('invalid and reversed dates are rejected', () => {
  assert.equal(validDate('2030-02-30'), false); assert.equal(validDate('2030-1-01'), false);
  assert.throws(() => validateRange('2030-01-05', '2030-01-01'));
  assert.throws(() => validateRange('2030-01-01', '2032-01-01'));
  assert.equal(overlaps({ start: '2030-01-01', end: '2030-01-03' }, { start: '2030-01-03', end: '2030-01-06' }), true);
});
test('import before enabling, overlapping booking rejected, cancellation frees dates', () => {
  let calendar = applyChange(null, { action: 'create', start: '2030-01-01', end: '2030-01-03' }, 'booking-1', 'owner');
  assert.equal(calendar.initialized, false);
  calendar = applyChange(calendar, { action: 'initialize' }, '', 'owner');
  assert.throws(() => applyChange(calendar, { action: 'create', start: '2030-01-02', end: '2030-01-06' }, 'booking-2', 'owner'));
  calendar = applyChange(calendar, { action: 'cancel', bookingId: 'booking-1' }, '', 'owner');
  assert.equal(availability(calendar, '2030-01-01', '2030-01-03').status, 'free');
});
test('simultaneous edits cannot overwrite one another', async () => {
  let row = { data: { initialized: true, bookings: [] }, etag: 'v1' };
  const store = {
    async getWithMetadata() { return structuredClone(row); },
    async setJSON(key, data, options) {
      if (options.onlyIfMatch !== row.etag) return { modified: false };
      row = { data, etag: 'v2' }; return { modified: true, etag: row.etag };
    },
  };
  const input = { action: 'create', start: '2030-01-01', end: '2030-01-03', version: 'v1' };
  const results = await Promise.all([saveChange(store, 'camry', input, '1', 'owner'), saveChange(store, 'camry', input, '2', 'owner')]);
  assert.equal(results.filter(r => !r.conflict).length, 1); assert.equal(row.data.bookings.length, 1);
  assert.equal((await saveChange(store, 'camry', input, '3', 'owner')).conflict, true);
});
