export const CARS = [
  { id: 'camry', name: 'Toyota Camry' },
  { id: 'mercedes', name: 'Mercedes-Benz E-Class' },
  { id: 'ford', name: 'Ford Focus' },
  { id: 'priora', name: 'LADA Priora' },
];
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateRange(start, end, min = today()) {
  if (!validDate(start) || !validDate(end)) throw new Error('Укажите корректные даты.');
  if (start < min || end < start) throw new Error('Проверьте порядок дат: начало не раньше сегодняшнего дня, возврат не раньше начала.');
  if (Date.parse(end) - Date.parse(start) > 366 * 86400000) throw new Error('Максимальный период: 366 дней.');
}
// Dates are inclusive: a car is not offered on the day it is returned.
export function overlaps(a, b) { return a.start <= b.end && b.start <= a.end; }
export function availability(calendar, start, end) {
  if (!calendar?.initialized) return { status: 'unknown', periods: [] };
  const periods = calendar.bookings.filter(b => b.status === 'confirmed' && b.end >= start).map(({ start, end }) => ({ start, end }));
  return { status: periods.some(p => overlaps(p, { start, end })) ? 'booked' : 'free', periods };
}
export function applyChange(calendar, input, id, userId, now = new Date().toISOString()) {
  const next = structuredClone(calendar || { initialized: false, bookings: [] });
  if (input.action === 'initialize') next.initialized = true;
  else if (input.action === 'create') {
    validateRange(input.start, input.end, '2000-01-01');
    if (input.end < today()) throw new Error('Дата возврата не может быть в прошлом.');
    if (next.bookings.some(b => b.status === 'confirmed' && overlaps(b, input))) throw new Error('Машина уже забронирована на эти даты.');
    next.bookings.push({ id, start: input.start, end: input.end, status: 'confirmed', createdAt: now, createdBy: userId });
  } else if (input.action === 'cancel') {
    const booking = next.bookings.find(b => b.id === input.bookingId);
    if (!booking) throw new Error('Бронь не найдена. Обновите страницу.');
    booking.status = 'cancelled'; booking.cancelledAt = now; booking.cancelledBy = userId;
  } else throw new Error('Неизвестное действие.');
  next.updatedAt = now;
  return next;
}
export async function saveChange(store, carId, input, id, userId) {
  const key = `calendar/${carId}`;
  const current = await store.getWithMetadata(key, { type: 'json' });
  if ((current?.etag || null) !== input.version) return { conflict: true };
  const next = applyChange(current?.data, input, id, userId);
  const saved = await store.setJSON(key, next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
  // One conditional write covers the entire calendar. Concurrent updates require a reload.
  if (!saved.modified) return { conflict: true };
  return { conflict: false, version: saved.etag };
}
