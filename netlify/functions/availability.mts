import type { Context, Config } from '@netlify/functions';
import { CARS, availability, validateRange, today } from './_shared/booking.mjs';
import { bookingStore, json } from './_shared/store.mts';
export default async (req: Request, context: Context) => {
  if (req.method !== 'GET') return json({ error: 'Метод не поддерживается.' }, 405);
  const params = new URL(req.url).searchParams;
  const start = params.get('start') || today(), end = params.get('end') || start;
  try { validateRange(start, end); } catch (error) { return json({ error: (error as Error).message }, 400); }
  try {
    const store = bookingStore(context);
    const cars = await Promise.all(CARS.map(async car => ({ ...car, ...availability(await store.get(`calendar/${car.id}`, { type: 'json' }), start, end) })));
    return json({ start, end, cars, checkedAt: new Date().toISOString(), timezone: 'Europe/Moscow' });
  } catch { return json({ error: 'Не удалось проверить доступность. Попробуйте ещё раз.' }, 503); }
};
export const config: Config = { path: '/api/availability' };
