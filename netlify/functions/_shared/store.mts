import { getStore, getDeployStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
export function bookingStore(context: Context) {
  return context.deploy.context === 'production'
    ? getStore({ name: 'mans-bookings-v1', consistency: 'strong' })
    : getDeployStore({ name: 'mans-bookings-v1', consistency: 'strong' });
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
