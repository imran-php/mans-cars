(() => {
  const ids = { 'Toyota Camry': 'camry', 'Mercedes-Benz E-Class': 'mercedes', 'Ford Focus': 'ford', 'LADA Priora': 'priora' };
  const labels = { free: 'Свободна', booked: 'Забронирована', unknown: 'Уточнить наличие', loading: 'Проверяем…' };
  const picker = document.querySelector('#availability-form');
  const from = document.querySelector('#availability-start'), to = document.querySelector('#availability-end');
  const message = document.querySelector('#availability-message');
  const booking = document.querySelector('#booking'), bookingForm = document.querySelector('#booking-form');
  const car = document.querySelector('#car-select'), begin = bookingForm.elements.start, finish = bookingForm.elements.end;
  const bookingStatus = document.querySelector('#booking-availability'), periods = document.querySelector('#booking-periods');
  const submit = bookingForm.querySelector('[type=submit]');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  from.min = to.min = from.value = to.value = today; begin.min = finish.min = today;
  let catalogSequence = 0, bookingSequence = 0;
  const niceDate = s => s.split('-').reverse().join('.');
  async function getAvailability(start, end) {
    const response = await fetch(`/api/availability?${new URLSearchParams({ start, end })}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.cars)) throw new Error(data.error || 'Не удалось проверить даты.');
    return data;
  }
  async function loadCatalog() {
    to.min = from.value || today;
    to.setCustomValidity(to.value < from.value ? 'Возврат не может быть раньше начала.' : '');
    if (!picker.reportValidity()) return;
    const sequence = ++catalogSequence;
    document.querySelectorAll('[data-status-car]').forEach(el => { el.dataset.state = 'loading'; el.textContent = labels.loading; });
    message.textContent = 'Проверяем доступность…';
    try {
      const data = await getAvailability(from.value, to.value);
      if (sequence !== catalogSequence) return;
      for (const item of data.cars) {
        const el = document.querySelector(`[data-status-car="${item.id}"]`);
        if (el) { el.textContent = labels[item.status] || labels.unknown; el.dataset.state = item.status; }
      }
      message.textContent = `На ${niceDate(data.start)} — ${niceDate(data.end)}, включительно. Бронь подтверждает менеджер.`;
    } catch {
      if (sequence !== catalogSequence) return;
      document.querySelectorAll('[data-status-car]').forEach(el => { el.dataset.state = 'unknown'; el.textContent = labels.unknown; });
      message.textContent = 'Не удалось загрузить календарь. Нажмите «Проверить» ещё раз или уточните наличие в WhatsApp.';
    }
  }
  async function checkBooking() {
    const sequence = ++bookingSequence;
    periods.replaceChildren(); submit.disabled = true;
    finish.min = begin.value || today;
    if (!begin.value || !finish.value || begin.value < today || finish.value < begin.value) {
      bookingStatus.textContent = 'Укажите корректные даты для проверки.';
      bookingStatus.dataset.state = 'unknown'; return null;
    }
    bookingStatus.textContent = labels.loading; bookingStatus.dataset.state = 'loading';
    try {
      const data = await getAvailability(begin.value, finish.value);
      if (sequence !== bookingSequence) return null;
      const item = data.cars.find(c => c.id === ids[car.value]);
      if (!item) throw new Error('Нет данных об автомобиле.');
      bookingStatus.textContent = item.status === 'booked' ? 'Забронирована на эти даты. Выберите другой период.' : item.status === 'free' ? 'Свободна на выбранные даты. Можно отправить запрос.' : 'Календарь ещё не подтверждён. Уточните наличие у менеджера.';
      bookingStatus.dataset.state = item.status;
      submit.disabled = item.status === 'booked';
      submit.textContent = item.status === 'unknown' ? 'Уточнить в WhatsApp ↗' : 'Продолжить в WhatsApp ↗';
      if (item.periods.length) {
        const title = document.createElement('p'); title.textContent = 'Занятые даты (включительно):'; periods.append(title);
        const list = document.createElement('ul');
        item.periods.slice(0, 12).forEach(p => { const li = document.createElement('li'); li.textContent = `${niceDate(p.start)} — ${niceDate(p.end)}`; list.append(li); });
        periods.append(list);
      }
      return item;
    } catch {
      if (sequence !== bookingSequence) return null;
      bookingStatus.textContent = 'Календарь недоступен. Наличие можно уточнить в WhatsApp.';
      bookingStatus.dataset.state = 'unknown'; submit.disabled = false; submit.textContent = 'Уточнить в WhatsApp ↗';
      return { status: 'unknown' };
    }
  }
  picker.addEventListener('submit', e => { e.preventDefault(); loadCatalog(); });
  [from, to].forEach(el => el.addEventListener('change', () => { if (to.value < from.value) to.value = from.value; loadCatalog(); }));
  document.querySelectorAll('[data-car]').forEach(b => b.addEventListener('click', () => { begin.value = from.value; finish.value = to.value; checkBooking(); }));
  [begin, finish, car].forEach(el => el.addEventListener('change', checkBooking));
  bookingForm.addEventListener('submit', async e => {
    e.preventDefault(); if (!bookingForm.reportValidity()) return;
    // Open a blank window synchronously to avoid popup blocking after server validation.
    const target = window.open('about:blank', '_blank'); if (target) target.opener = null;
    const chosen = { car: car.value, start: begin.value, end: finish.value };
    const item = await checkBooking();
    if (!item || item.status === 'booked' || chosen.car !== car.value || chosen.start !== begin.value || chosen.end !== finish.value) { target?.close(); return; }
    const text = `Здравствуйте! Интересует аренда ${chosen.car} с ${niceDate(chosen.start)} по ${niceDate(chosen.end)} включительно. Подтвердите, пожалуйста, наличие, стоимость и бронь.`;
    const url = `https://wa.me/79770079889?text=${encodeURIComponent(text)}`;
    if (target) target.location.href = url; else location.href = url;
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadCatalog(); if (booking.open) checkBooking(); } });
  setInterval(() => { if (!document.hidden) { loadCatalog(); if (booking.open) checkBooking(); } }, 60000);
  loadCatalog();
})();
