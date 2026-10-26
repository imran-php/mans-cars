import { login, logout, getUser, handleAuthCallback, acceptInvite, updateUser } from '@netlify/identity';
const $ = s => document.querySelector(s), panel = $('#admin-panel'), message = $('#admin-message');
let cars = [], inviteToken = null;
function notify(text, error = false) { message.textContent = text; message.classList.toggle('error', error); }
const date = s => s.split('-').reverse().join('.');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function api(method = 'GET', body) {
  const response = await fetch('/api/bookings', { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не удалось получить календарь.');
  return data;
}
function element(tag, text, className) { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }
async function load() { const data = await api(); cars = data.cars; render(); }
async function mutate(car, action, extra = {}) {
  document.querySelectorAll('#admin-panel button').forEach(b => b.disabled = true);
  try { await api('POST', { carId: car.id, version: car.version, action, ...extra }); await load(); notify('Сохранено. Статус автомобиля обновлён на сайте.'); }
  catch (error) { notify(error.message, true); await load().catch(() => {}); }
  finally { document.querySelectorAll('#admin-panel button').forEach(b => b.disabled = false); }
}
function render() {
  const root = $('#admin-cars'); root.replaceChildren();
  for (const car of cars) {
    const block = element('article', null, 'admin-car'); block.append(element('h2', car.name));
    block.append(element('p', car.calendar.initialized ? 'Календарь включён. Незанятые даты показываются как свободные.' : 'Календарь не подтверждён. На сайте: «Уточнить наличие».'));
    if (!car.calendar.initialized) {
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
      const label = element('label', null, 'check'); label.append(checkbox, document.createTextNode('Все действующие и будущие брони этого автомобиля внесены в календарь.'));
      const enable = element('button', 'Включить календарь', 'enable-calendar'); enable.addEventListener('click', () => { if (!checkbox.checked) { notify('Подтвердите, что все существующие брони внесены.', true); return; } mutate(car, 'initialize'); });
      block.append(label, enable);
    }
    {
      const form = document.createElement('form'); const dates = element('div', null, 'dates');
      for (const [name, title] of [['start', 'С даты'], ['end', 'По дату включительно']]) {
        const label = element('label', title); const input = document.createElement('input'); input.type = 'date'; input.name = name; input.required = true; input.min = name === 'start' ? '2000-01-01' : today; label.append(input); dates.append(label);
      }
      const button = element('button', 'Подтвердить бронь', 'button'); button.type = 'submit';
      form.append(dates, button); form.addEventListener('submit', e => { e.preventDefault(); const start = form.elements.start.value, end = form.elements.end.value; if (end < start) { notify('Возврат не может быть раньше начала.', true); return; } mutate(car, 'create', { start, end }); }); block.append(form);
    }
    const list = element('ul');
    const bookings = [...car.calendar.bookings].filter(b => b.end >= today).sort((a, b) => a.start.localeCompare(b.start));
    for (const booking of bookings) {
      const li = element('li', null, booking.status === 'cancelled' ? 'cancelled' : '');
      li.append(element('span', `${date(booking.start)} — ${date(booking.end)} · ${booking.status === 'confirmed' ? 'Забронирована' : 'Отменена'}`));
      if (booking.status === 'confirmed') { const cancel = element('button', 'Отменить бронь', 'cancel'); cancel.addEventListener('click', () => { if (confirm(`Отменить бронь ${car.name} с ${date(booking.start)} по ${date(booking.end)}?`)) mutate(car, 'cancel', { bookingId: booking.id }); }); li.append(cancel); }
      list.append(li);
    }
    if (!bookings.length) list.append(element('li', 'Будущих броней пока нет.'));
    block.append(list); root.append(block);
  }
}
async function enter(user) {
  if (!user) return;
  $('#logout').hidden = false;
  if (!user.roles?.includes('booking-admin')) { notify('Вы вошли, но у аккаунта нет роли booking-admin. Назначьте её в Netlify Identity.', true); return; }
  $('#login-panel').hidden = true; $('#password-panel').hidden = true; panel.hidden = false; await load(); notify('Календарь загружен.');
}
$('#login-form').addEventListener('submit', async e => { e.preventDefault(); const form = e.currentTarget, button = form.querySelector('button'); button.disabled = true; try { await enter(await login(form.elements.email.value, form.elements.password.value)); form.reset(); } catch { notify('Не удалось войти. Проверьте email, пароль и подключение Netlify Identity.', true); } finally { button.disabled = false; } });
$('#logout').addEventListener('click', async () => { try { await logout(); location.reload(); } catch { notify('Не удалось выйти. Повторите попытку.', true); } });
$('#refresh').addEventListener('click', () => load().then(() => notify('Календарь обновлён.')).catch(e => notify(e.message, true)));
$('#password-form').addEventListener('submit', async e => { e.preventDefault(); const button = e.currentTarget.querySelector('button'); button.disabled = true; try { const password = e.currentTarget.elements.password.value; const user = inviteToken ? await acceptInvite(inviteToken, password) : await updateUser({ password }); inviteToken = null; await enter(user); } catch { notify('Не удалось сохранить пароль. Проверьте ссылку приглашения и повторите попытку.', true); } finally { button.disabled = false; } });
try { const callback = await handleAuthCallback(); if (callback?.type === 'invite' || callback?.type === 'recovery') { inviteToken = callback.type === 'invite' ? callback.token : null; $('#login-panel').hidden = true; $('#password-panel').hidden = false; } else await enter(await getUser()); } catch { notify('Не удалось проверить вход. Netlify Identity должен быть включён для этого сайта.', true); }
