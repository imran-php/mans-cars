import type { Context, Config } from '@netlify/functions';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { randomUUID } from 'node:crypto';
import { CARS, saveChange } from './_shared/booking.mjs';
import { bookingStore, json } from './_shared/store.mts';
export default async (req: Request, context: Context) => {
  const user = await getUser();
  if (!user) return json({ error: 'Войдите в аккаунт администратора.' }, 401);
  if (!user.roles?.includes('booking-admin')) return json({ error: 'Нет прав управления бронированиями. Нужна роль booking-admin.' }, 403);
  try {
    const store = bookingStore(context);
    if (req.method === 'GET') {
      const cars = await Promise.all(CARS.map(async car => {
        const stored = await store.getWithMetadata(`calendar/${car.id}`, { type: 'json' });
        return { ...car, calendar: stored?.data || { initialized: false, bookings: [] }, version: stored?.etag || null };
      }));
      return json({ cars });
    }
    if (req.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405);
    try { verifyRequestOrigin(req); } catch { return json({ error: 'Недопустимый источник запроса.' }, 403); }
    if (!req.headers.get('content-type')?.includes('application/json')) return json({ error: 'Ожидается JSON.' }, 415);
    const body = await req.text();
    if (body.length > 4096) return json({ error: 'Слишком большой запрос.' }, 413);
    let input;
    try { input = JSON.parse(body); } catch { return json({ error: 'Неверный формат запроса.' }, 400); }
    if (!input || !CARS.some(c => c.id === input.carId)) return json({ error: 'Автомобиль не найден.' }, 400);
    let result;
    try { result = await saveChange(store, input.carId, input, randomUUID(), user.id); }
    catch (error) {
      const msg = (error as Error).message;
      if (/дат|период|календарь|забронирована|Бронь|действие/.test(msg)) return json({ error: msg }, 400);
      throw error;
    }
    if (result.conflict) return json({ error: 'Календарь изменился в другом окне. Обновите список и повторите действие.' }, 409);
    return json({ saved: true });
  } catch { return json({ error: 'Изменения не сохранены. Попробуйте ещё раз.' }, 503); }
};
export const config: Config = { path: '/api/bookings' };
