const contact = { phone: '+919914911605', whatsapp: '919914911605', instagram: 'https://ig.me/m/oberoitiffen' };
const greeting = 'Hi Oberoi Tiffin!';
const whatsappLink = (message) => 'https://wa.me/' + contact.whatsapp + '?text=' + encodeURIComponent(message);
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const breakfast = ['Mix Parantha', 'Methi Parantha', 'Gobhi Parantha', 'Paneer Parantha', 'Mix Parantha', 'Bread Sandwich', 'Aloo Puri'];
const dinner = ['Mix Veg & Dal', 'Palak Paneer & Rajma', 'Gobhi Aloo & Dal', 'Matar Paneer & Dal', 'Methi Aloo & Chole', 'Kofte & Dal', 'Jeera Aloo & Dal'];
const sides = { rice: 'Rice + 3 chapatis', chapati: '5 chapatis' };
const prices = { Breakfast: 60, Dinner: 70, Combo: 130 };
const monthlyPlans = { breakfast: ['Breakfast', '₹1,800'], dinner: ['Dinner', '₹2,100'], combo: ['Breakfast + Dinner', '₹3,900'] };
const $ = (selector) => document.querySelector(selector);
const money = (number) => '₹' + number;
const localDay = () => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format();
const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', dateStyle: 'short' }).format();
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
let cart = read('dbb-cart', []);
let requests = read('dbb-requests', []);
let deliveryPin = null;
let detectedAddress = '';
let lastDelivery = null;
let whatsappRequest = null;
let day = weekdays.indexOf(localDay());
let variant = 'rice';
let timer;
const dialog = $('#panel');
const body = $('#panel-body');

function notify(message) {
  clearTimeout(timer);
  const toast = dialog.open ? $('#panel-toast') : $('#toast');
  const content = document.createElement('span');
  content.textContent = message;
  $('#toast').replaceChildren();
  $('#panel-toast').replaceChildren();
  toast.replaceChildren(content);
  timer = setTimeout(() => { toast.replaceChildren(); }, 3300);
}
function updateCart() {
  const count = $('#count');
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (Number(count.textContent) !== quantity && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    count.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.32)' }, { transform: 'scale(1)' }], 290);
  }
  count.textContent = quantity;
  try { localStorage.setItem('dbb-cart', JSON.stringify(cart)); }
  catch { notify('Your bag is available for this visit only.'); }
}
function keepTodaysBag() {
  const date = localDate();
  const today = weekdays.indexOf(localDay());
  const current = cart.filter(item => item.date === date && item.day === today);
  if (current.length === cart.length) return false;
  cart = current;
  updateCart();
  return true;
}
function renderMenu(focusDay = false) {
  const today = localDay();
  $('#menu-order-note').textContent = weekdays[day] === today
    ? 'Ordering from today’s menu · ' + today
    : weekdays[day] + ' menu preview. Orders are available for today (' + today + ') only.';
  $('#days').innerHTML = weekdays.map((name, index) =>
    `<button class="day" data-day="${index}" aria-label="${name}" aria-pressed="${day === index}">${name.slice(0, 3)}</button>`).join('');
  const includesKheer = day === 1 || day === 5;
  $('#meals').innerHTML = `
    <article class="meal"><img class="dish-photo" src="assets/breakfast-${day === 4 ? 0 : day}.jpg" alt="Serving illustration of ${breakfast[day]}"><div><span class="kind">Breakfast · ₹60</span>
    <h3>${breakfast[day]}</h3><p>${day < 5 ? '2 paranthas with curd and pickle' : 'See the kitchen for serving details.'}</p>
    <div class="meal-controls"><button class="button dark" data-add="Breakfast">Add breakfast</button></div></div></article>
    <article class="meal"><img class="dish-photo" src="assets/dinner-${day}.jpg" alt="Serving illustration of ${dinner[day]}"><div><span class="kind">Dinner · ₹70</span>
    <h3>${dinner[day]}</h3><p>With salad and raita${includesKheer ? ' · Kheer included' : ''}</p>
    <div class="meal-controls"><div><label for="side">Dinner side</label><select id="side"><option value="rice">Rice + 3 chapatis</option><option value="chapati">5 chapatis</option></select></div><button class="button dark" data-add="Dinner">Add dinner</button></div></div></article>
    <article class="meal combo"><div><h3>Breakfast + Dinner</h3><p>Both meals for ${weekdays[day]}, with your selected dinner side.</p></div><button class="button dark" data-add="Combo">Add combo · ₹130</button></article>`;
  $('#side').value = variant;
  if (focusDay) $(`[data-day="${day}"]`).focus();
}
function add(kind) {
  const today = localDay();
  if (weekdays[day] !== today) {
    show('Order from today’s menu', `<div class="stack"><p>We’re taking orders for ${today} only. You can still preview the rest of the week.</p><button class="button dark" id="go-today">Show today’s meals</button></div>`);
    return;
  }
  keepTodaysBag();
  const side = kind === 'Breakfast' ? '' : sides[variant];
  const match = cart.find((item) => item.kind === kind && item.day === day && item.side === side);
  if (match) match.quantity++;
  else cart.push({kind, day, side, quantity: 1, date: localDate()});
  updateCart();
  notify(kind + ' added · ' + money(total()) + ' in your bag');
}
function show(title, html) {
  stopTracking();
  $('#panel-title').textContent = title;
  body.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}
function itemLabel(item) {
  return `${weekdays[item.day]} · ${item.kind}`;
}
function describe(item) {
  const meals = {Breakfast: breakfast[item.day], Dinner: dinner[item.day], Combo: breakfast[item.day] + ' / ' + dinner[item.day]};
  return meals[item.kind] + (item.side ? ' · ' + item.side : '');
}
const total = () => cart.reduce((sum, item) => sum + item.quantity * prices[item.kind], 0);
function renderCart() {
  const removed = keepTodaysBag();
  show('Your bag', cart.length ? `<div class="stack">
    ${cart.map((item, index) => `<div class="row"><div><strong>${itemLabel(item)}</strong><p class="note">${describe(item)}</p><p>${money(item.quantity * prices[item.kind])}</p></div>
      <div class="quantity"><button class="button light" data-adjust="${index}" data-delta="-1" aria-label="Remove one ${item.kind}">−</button><span>${item.quantity}</span><button class="button light" data-adjust="${index}" data-delta="1" aria-label="Add one ${item.kind}">+</button></div></div>`).join('')}
    <p class="row"><span>Delivery in Kharar</span><strong>Free</strong></p>
    <p class="row"><strong>Meal total</strong><strong>${money(total())}</strong></p>
    <button class="button dark" data-open="checkout">Continue to checkout</button></div>`
    : '<div class="stack"><p>Your bag is empty.</p><a class="button dark" href="#menu" data-close>Browse the menu</a></div>');
  if (removed) notify('Older meals were removed. Choose from today’s menu.');
}
function renderCheckout() {
  if (keepTodaysBag()) { renderCart(); notify('Older meals were removed. Choose from today’s menu.'); return; }
  if (!cart.length) return renderCart();
  show('Delivery details', `<form class="stack" id="checkout">
    ${deliveryFields()}
    <p class="note">Add a delivery pin to see your destination and estimated arrival on the tracking map.</p>
    <p class="note">Your selected delivery details go to the kitchen and rider so they can find you and call when they arrive.</p>
    <button class="button dark">Prepare WhatsApp order · ${money(total())}</button></form>`);
  fillDelivery($('#checkout'));
}
function deliveryMessage(id, details) {
  const items = cart.map((item) => `${item.quantity} × ${itemLabel(item)} | ${describe(item)} | ${money(item.quantity * prices[item.kind])}`);
  return [greeting + ' I’d like to place this order for today (' + localDate() + ').', 'Reference: ' + id, ...items,
    'Free delivery in Kharar', 'Meal total: ' + money(total()), ...contactLines(details)].join('\n');
}
function contactLines(details) {
  return ['Name: ' + details.name, 'Mobile: ' + details.phone,
    details.address ? 'Kharar address: ' + details.address : '',
    details.pin ? 'Delivery pin: ' + mapLink(details.pin) : ''].filter(Boolean);
}
function prepareWhatsApp(request) {
  whatsappRequest = request;
  show(request.title, `<form class="stack" id="whatsapp-form">
    <p class="note">${escapeText(request.summary)}${request.plan ? ' Your name and location will be included in the WhatsApp message.' : ''}</p>
    ${request.plan ? deliveryFields() : ''}
    ${request.plan ? '<label>Preferred start date<input name="start" type="date" required></label>' : ''}
    ${request.query ? '<label>How can we help?<textarea name="query" required maxlength="350"></textarea></label>' : ''}
    <button class="button dark">Continue to WhatsApp</button></form>`);
  const form = $('#whatsapp-form');
  if (request.plan) {
    fillDelivery(form);
    const date = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit'}).format();
    form.elements.start.min = date;
    form.elements.start.value = date;
  }
}
function openWhatsApp(title, message, note) {
  const url = whatsappLink(message);
  show(title, `<div class="stack"><p>${note}</p>
    <a class="button dark" href="${url}" target="_blank" rel="noopener">Open WhatsApp</a></div>`);
  window.open(url, '_blank', 'noopener,noreferrer');
}
const orderKey = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
const trackingLink = (id, token) => location.origin + '/#track=' + id + '.' + token;
let pendingTracking = null;
async function prepareTrackedOrder(form, details) {
  const items = JSON.stringify(cart);
  const fingerprint = JSON.stringify([items, details.pin]);
  if (pendingTracking?.fingerprint !== fingerprint) {
    pendingTracking = {fingerprint, id:'DBB-' + orderKey().slice(0,16).toUpperCase(), viewer:orderKey(), rider:orderKey()};
  }
  const {id, viewer, rider} = pendingTracking;
  const message = deliveryMessage(id, details);
  const mealCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const mealTotal = total();
  try {
    await api('/guest/create', {id, viewer, rider, items:JSON.parse(items), pin:details.pin});
  } catch (error) {
    if (!form.isConnected || !dialog.open) return;
    show('Send your order request', `<div class="stack"><p>Live tracking could not be created. You can still send this order through WhatsApp.</p>
      <a class="button dark" target="_blank" rel="noopener" href="${whatsappLink(message)}">Send without live tracking</a>
      <button class="button light" data-open="checkout">Try tracking again</button></div>`);
    return;
  }
  if (!form.isConnected || !dialog.open) return;
  requests = [{id, mealTotal, mealCount, viewer}, ...requests.filter(order => order.id !== id)].slice(0,20);
  try { localStorage.setItem('dbb-requests', JSON.stringify(requests)); } catch {}
  const sellerText = message + '\n\nRider only: open at the shop and tap Start location sharing.\n' + trackingLink(id, rider);
  show('Send your order request', `<div class="stack"><p>Open WhatsApp and tap Send. The kitchen receives your delivery details and a private link for the rider.</p>
    <a class="button dark" target="_blank" rel="noopener" href="${whatsappLink(sellerText)}">Open WhatsApp</a>
    <a class="button light" href="${trackingLink(id,viewer)}" data-track-link>Open live tracking</a>
    <p class="note">Keep this tracking link. It shows updates once the rider starts sharing.</p></div>`);
}
const mapZoom = 14;
const tilePoint = ([lat, lng]) => {
  const scale = 2 ** mapZoom;
  return [(lng + 180) / 360 * scale, (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * scale];
};
const khararTile = tilePoint([30.746,76.646]).map(Math.floor);
const mapCorner = khararTile.map(value => value - 1);
function buildTrackingMap() {
  let tiles = '';
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      tiles += `<img alt="" referrerpolicy="origin" src="https://tile.openstreetmap.org/${mapZoom}/${mapCorner[0] + x}/${mapCorner[1] + y}.png">`;
    }
  }
  return `<div class="tracking-map" aria-label="Delivery map of Kharar">
    <div class="map-tiles">${tiles}</div>
    <span class="map-marker origin" id="map-start" hidden>Start</span>
    <span class="map-marker rider" id="map-rider" hidden>Rider</span>
    <span class="map-marker destination" id="map-destination" hidden>You</span>
    <a class="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></div>`;
}
function putMarker(id, pin) {
  const marker = $(id);
  if (!pin) { marker.hidden = true; return; }
  const [x,y] = tilePoint(pin).map((value,index) => (value - mapCorner[index]) / 3 * 100);
  marker.hidden = ![x,y].every(value => Number.isFinite(value) && value >= 0 && value <= 100);
  marker.style.left = x + '%';
  marker.style.top = y + '%';
}
function estimateMinutes(from, to) {
  const radians = Math.PI / 180;
  const [lat1,lon1] = from.map(value => value * radians);
  const [lat2,lon2] = to.map(value => value * radians);
  const a = Math.sin((lat2-lat1)/2) ** 2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin((lon2-lon1)/2) ** 2;
  const km = 12742 * Math.asin(Math.sqrt(Math.min(1,a)));
  const estimate = Math.max(2,Math.round(km * 1.4 / 18 * 60 + 2));
  return [Math.max(2,estimate - 2),estimate + 4];
}
let stopTracking = () => {};
function showDeliverySuccess(id, riderView) {
  const order = requests.find(request => request.id === id);
  if (order && !order.delivered) {
    order.delivered = true;
    try { localStorage.setItem('dbb-requests', JSON.stringify(requests)); } catch {}
  }
  const title = riderView ? 'Delivery successful!' : 'Order received!';
  const message = riderView
    ? 'This order is marked delivered. Location sharing has ended.'
    : 'Thank you for choosing Oberoi Tiffin. Enjoy your meal!';
  show(title, `<div class="delivery-success stack">
    <div class="delivery-celebration" aria-hidden="true">
      <span class="delivery-check">✓</span>
      <i></i><i></i><i></i><i></i><i></i><i></i>
    </div>
    <p role="status" aria-live="polite"><strong class="delivery-reference">${id}</strong> <span>${message}</span></p>
    <button class="button dark" id="dismiss-delivery-success">Done</button>
  </div>`);
  $('#dismiss-delivery-success').onclick = () => dialog.close();
  $('#dismiss-delivery-success').focus();
}
function showTracking(id, token) {
  show('Live order tracking', `<div class="stack" id="tracking-view"><strong>${id}</strong>
    <p role="status" id="tracking-state">Connecting to your order…</p>
    ${buildTrackingMap()}
    <p class="note" id="tracking-eta"></p>
    <div class="location-actions" id="rider-actions" hidden>
      <button class="button dark" id="rider-share">Start location sharing</button>
      <button class="button light" id="rider-pause" hidden>Pause sharing</button>
      <button class="button light" id="rider-delivered">Mark delivered</button>
    </div><p class="note" id="rider-feedback" role="status"></p></div>`);
  const view = $('#tracking-view');
  let poll, watch;
  let active = true;
  let lastSent = 0;
  const key = {id,token};
  const stopSharing = () => {
    if (watch !== undefined) navigator.geolocation.clearWatch(watch);
    watch = undefined;
  };
  stopTracking = () => {
    active = false;
    clearTimeout(poll);
    stopSharing();
  };
  const refresh = async () => {
    try {
      const data = await api('/guest/track', key);
      if (!active) return;
      const {status,updated,destination,start,rider,canShare} = data;
      if (status === 'delivered') {
        showDeliverySuccess(id, canShare);
        return;
      }
      const stale = Boolean(updated && Date.now() - updated > 35000);
      $('#tracking-state').textContent = rider ? (stale ? 'Rider location is temporarily stale' : 'Your rider is on the way')
          : 'Waiting for the rider to start sharing';
      putMarker('#map-start', start);
      putMarker('#map-rider', rider);
      putMarker('#map-destination', destination);
      const eta = rider && destination && !stale ? estimateMinutes(rider,destination) : null;
      $('#tracking-eta').textContent = eta
        ? `Estimated arrival ${eta[0]}–${eta[1]} min · Distance-based estimate`
        : !destination ? 'Arrival estimate requires a destination map pin.' : 'Arrival estimate appears once the rider is sharing.';
      $('#rider-actions').hidden = !canShare;
    } catch (error) {
      if (!active) return;
      $('#tracking-state').textContent = error.message;
      $('#tracking-eta').textContent = '';
    }
    poll = setTimeout(refresh, 7000);
  };
  const share = $('#rider-share');
  const pause = $('#rider-pause');
  share.onclick = () => {
    if (!navigator.geolocation) { $('#rider-feedback').textContent = 'Location is unavailable on this device.'; return; }
    share.hidden = true;
    pause.hidden = false;
    $('#rider-feedback').textContent = 'Allow location access and keep this tab open while delivering.';
    watch = navigator.geolocation.watchPosition(async ({coords}) => {
      if (!active || watch === undefined || Date.now() - lastSent < 6000) return;
      lastSent = Date.now();
      try {
        await api('/guest/location', {...key,pin:[coords.latitude,coords.longitude]});
        if (active && watch !== undefined) $('#rider-feedback').textContent = 'Location sharing is active. Keep this page open.';
      } catch (error) { if (active) $('#rider-feedback').textContent = error.message; }
    }, () => {
      if (!active) return;
      stopSharing();
      share.hidden = false;
      pause.hidden = true;
      $('#rider-feedback').textContent = 'Location unavailable. Allow location access in your browser and try again.';
    }, {enableHighAccuracy:true,timeout:12000,maximumAge:0});
  };
  pause.onclick = () => {
    stopSharing();
    share.hidden = false;
    pause.hidden = true;
    $('#rider-feedback').textContent = 'Sharing paused.';
  };
  $('#rider-delivered').onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await api('/guest/location', {...key,delivered:true}); if (view.isConnected) { clearTimeout(poll); await refresh(); } }
    catch (error) { if (view.isConnected) $('#rider-feedback').textContent = error.message; }
    finally { button.disabled = false; }
  };
  refresh();
}
function trackFromHash() {
  const match = location.hash.match(/^#track=(DBB-[A-F0-9]{16})\.([a-f0-9]{64})$/);
  if (match) showTracking(match[1], match[2]);
}
function renderGuestTracking() {
  show('Track order', requests.length ? `<div class="stack"><p class="note">Orders prepared on this device. Live updates begin when your rider shares their location.</p>
    ${requests.filter(({id}) => /^DBB-[A-F0-9]{8,16}$/.test(id)).map(({id, mealTotal, mealCount, viewer, delivered}) => `<div class="row"><div><strong>${id}</strong><p class="note">${delivered ? 'Delivered' : 'Request prepared'}</p>
    ${Number.isInteger(mealTotal) && Number.isInteger(mealCount) ? `<p class="note">${mealCount} bag items · ${money(mealTotal)}</p>` : ''}</div>
    ${/^[a-f0-9]{64}$/.test(viewer) ? `<a class="button light" data-track-link href="${trackingLink(id,viewer)}">Live tracking</a>`
      : `<button class="button light" data-status="${id}">Ask for update</button>`}</div>`).join('')}</div>`
    : '<p>No requests on this device yet. After you prepare an order, its reference will appear here.</p>');
}
async function api(path, data) {
  const response = await fetch('/api' + path, data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Please try again.');
  return result;
}
const mapLink = ([lat, lng]) => 'https://www.google.com/maps?q=' + lat + ',' + lng;
function deliveryFields() {
  return `<label>Name<input name="name" required autocomplete="name" maxlength="80"></label>
  <label>Delivery phone<input name="phone" type="tel" required autocomplete="tel" maxlength="18"></label>
  <label>Address or landmark in Kharar<textarea name="address" autocomplete="street-address" placeholder="Hostel, PG or flat, locality and landmark" maxlength="350"></textarea></label>
  <div class="location-actions"><button type="button" class="button light" id="get-location">Use current location</button>
  <button type="button" class="button light" id="clear-location" hidden>Remove pin</button></div>
  <p class="note" id="pin-label" role="status">Type an address, add a location pin, or use both.</p>
  <p class="note">Use current location sends your GPS coordinates to BigDataCloud to find the area name.</p>
  <a id="view-pin" class="note" target="_blank" rel="noopener" hidden>Check pin on Maps</a>
  <details class="pin-tools"><summary>Add a pin from Google Maps</summary><p class="note">Long-press your delivery point in Maps, then paste the latitude and longitude shown for the dropped pin.</p>
    <label>Map coordinates<input id="pin-coordinates" maxlength="80" placeholder="Latitude, longitude"></label>
    <button type="button" class="button light" id="manual-pin">Use this pin</button></details>`;
}
function fillDelivery(form) {
  const saved = lastDelivery || {};
  form.elements.name.value = saved.name || '';
  form.elements.phone.value = saved.phone || '';
  form.elements.address.value = saved.address || '';
  deliveryPin = saved.pin || null;
  updatePin();
}
function updatePin() {
  $('#clear-location').hidden = !deliveryPin;
  const link = $('#view-pin');
  link.hidden = !deliveryPin;
  if (deliveryPin) link.href = mapLink(deliveryPin);
  else link.removeAttribute('href');
  $('#get-location').textContent = deliveryPin ? 'Update current location' : 'Use current location';
  $('#pin-label').textContent = deliveryPin ? 'Location pin added. Check that it is where you want delivery.' : 'Type an address, add a location pin, or use both.';
}
async function fillDetectedAddress(button, pin) {
  const address = button.form?.elements.namedItem('address');
  if (!address || (address.value.trim() && address.value !== detectedAddress)) return;
  const original = address.value;
  const label = $('#pin-label');
  label.textContent = 'Location pin added. Looking up the area name…';
  const current = () => button.isConnected && dialog.open && deliveryPin === pin && address.value === original;
  try {
    const query = new URLSearchParams({latitude:pin[0], longitude:pin[1], localityLanguage:'en'});
    const response = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?' + query, {
      signal:AbortSignal.timeout(4500), referrerPolicy:'no-referrer',
    });
    if (!response.ok) throw new Error('Area lookup unavailable.');
    const result = await response.json();
    if (!current()) return;
    if (/^ip/i.test(result.lookupSource ?? '')) throw new Error('GPS area name unavailable.');
    const words = [result.locality, result.city, result.principalSubdivision]
      .filter(value => typeof value === 'string' && value.trim())
      .map(value => value.trim());
    const unique = [...new Map(words.map(value => [value.toLowerCase(), value])).values()];
    if (!String(result.locality || result.city || '').trim()) throw new Error('Area name unavailable.');
    detectedAddress = unique.join(', ').slice(0,350);
    address.value = detectedAddress;
    label.textContent = 'Area name filled in. Add your house, hostel or landmark if needed.';
  } catch {
    if (current()) label.textContent = 'Location pin added. Enter the area or landmark manually.';
  } finally {
    if (button.isConnected && dialog.open && deliveryPin === pin && address.value !== original &&
        label.textContent.includes('Looking up')) updatePin();
  }
}
function requestLocation(button) {
  const label = $('#pin-label');
  if (!navigator.geolocation) { label.textContent = 'Browser location is unavailable. Enter an address or add a pin from Google Maps.'; return; }
  button.disabled = true;
  label.textContent = 'Getting your location… Allow access if your browser asks.';
  let finished = false;
  const finish = (message, coords) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    if (!button.isConnected || !dialog.open) return;
    button.disabled = false;
    if (coords) {
      deliveryPin = [Number(coords.latitude.toFixed(6)), Number(coords.longitude.toFixed(6))];
      updatePin();
      fillDetectedAddress(button, deliveryPin);
    } else label.textContent = message + ' Enter an address or add a pin from Google Maps.';
  };
  const timeout = setTimeout(() => finish('Location took too long.'), 12000);
  try {
    navigator.geolocation.getCurrentPosition(({coords}) => finish('', coords), error => {
      const reason = error.code === 1
        ? 'Location access is blocked. Use your browser’s site settings to allow it, or open this site in your browser.'
        : 'Your device couldn’t find a location.';
      finish(reason);
    }, {enableHighAccuracy: false, timeout: 8500, maximumAge: 0});
  } catch { finish('Browser location is unavailable.'); }
}
const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panels = {cart: renderCart, checkout: renderCheckout, track: renderGuestTracking};
dialog.addEventListener('close', () => { stopTracking(); $('#panel-toast').replaceChildren(); });
window.addEventListener('hashchange', trackFromHash);
window.addEventListener('pagehide', () => stopTracking());
document.addEventListener('click', async (event) => {
  const trackLink = event.target.closest('[data-track-link]');
  if (trackLink && trackLink.hash === location.hash) { event.preventDefault(); trackFromHash(); return; }
  const target = event.target.closest('button, [data-close]');
  if (!target) return;
  if (target.matches('.close, [data-close]')) dialog.close();
  if (target.dataset.day !== undefined) { day = Number(target.dataset.day); renderMenu(true); }
  if (target.dataset.add) add(target.dataset.add);
  if (target.id === 'go-today') { dialog.close(); day = weekdays.indexOf(localDay()); renderMenu(true); }
  if (target.dataset.plan) {
    const [name, rate] = monthlyPlans[target.dataset.plan];
    prepareWhatsApp({title:'Monthly ' + name + ' plan', summary:rate + ' per month.', plan:name, rate});
  }
  if (target.id === 'whatsapp-query') prepareWhatsApp({title:'Message the kitchen', summary:'Send a question about orders or delivery.', query:true});
  if (target.dataset.open) panels[target.dataset.open]();
  if (target.dataset.status) prepareWhatsApp({title:'Ask for an order update', summary:'Order reference ' + target.dataset.status + '.', reference:target.dataset.status});
  if (target.id === 'get-location') requestLocation(target);
  if (target.id === 'clear-location') {
    const address = target.form?.elements.namedItem('address');
    if (address?.value === detectedAddress) address.value = '';
    deliveryPin = null;
    updatePin();
  }
  if (target.id === 'manual-pin') {
    const parts = $('#pin-coordinates').value.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
    if (!parts || Math.abs(Number(parts[1])) > 90 || Math.abs(Number(parts[2])) > 180) {
      notify('Enter latitude and longitude separated by a comma.');
    } else {
      deliveryPin = parts.slice(1).map(value => Number(Number(value).toFixed(6)));
      updatePin();
    }
  }
  if (target.dataset.adjust !== undefined) {
    if (keepTodaysBag()) { renderCart(); notify('Older meals were removed. Choose from today’s menu.'); return; }
    const index = Number(target.dataset.adjust);
    const item = cart[index];
    const delta = Number(target.dataset.delta);
    item.quantity += delta;
    if (!item.quantity) cart.splice(index, 1);
    updateCart();
    renderCart();
    notify(item.kind + (delta > 0 ? ' added' : ' removed') + ' · ' + money(total()) + ' in your bag');
    (body.querySelector(`[data-adjust="${index}"][data-delta="${target.dataset.delta}"]`) ?? body.querySelector('button, a'))?.focus();
  }
});
$('#days').addEventListener('keydown', (event) => {
  if (!event.target.matches('[data-day]')) return;
  const offset = {ArrowLeft: -1, ArrowRight: 1}[event.key];
  if (!offset) return;
  event.preventDefault();
  day = (day + offset + 7) % 7;
  renderMenu(true);
});
$('#today').onclick = () => { day = weekdays.indexOf(localDay()); renderMenu(true); };
$('#meals').addEventListener('change', (event) => { if (event.target.id === 'side') variant = event.target.value; });
function readDelivery(form) {
  const fields = new FormData(form);
  const digits = fields.get('phone').trim().replace(/[\s()+-]/g, '');
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  const details = {name: fields.get('name').trim(), phone: '+91' + national, address: fields.get('address').trim(), pin: deliveryPin};
  if (!details.name || !/^[6-9][0-9]{9}$/.test(national)) throw new Error('Enter your name and a valid Indian delivery number.');
  return details;
}
body.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!['checkout', 'whatsapp-form'].includes(form.id)) return;
  event.preventDefault();
  const button = form.querySelector('button[type="submit"], button:not([type])');
  button.disabled = true;
  try {
    const fields = new FormData(form);
    if (form.id === 'whatsapp-form') {
      const {title, plan, rate, query, reference} = whatsappRequest;
      const details = plan ? readDelivery(form) : null;
      if (details && !details.address && !details.pin) throw new Error('Add an address or use your current location.');
      const question = query ? fields.get('query').trim() : '';
      if (query && !question) throw new Error('Enter your question.');
      const subject = plan ? 'Please start my monthly ' + plan + ' plan (' + rate + ' per month). Preferred start: ' + fields.get('start') + '.'
        : reference ? 'Please share the status of order ' + reference + '.' : question;
      if (details) lastDelivery = details;
      openWhatsApp(title, [greeting, subject, ...(details ? contactLines(details) : [])].join('\n'), 'Your message is ready in WhatsApp. Tap Send to share it with the kitchen.');
      return;
    }
    const details = readDelivery(form);
    if (!details.address && !details.pin) throw new Error('Add an address or use your current location.');
    if (keepTodaysBag() || !cart.length) { renderCart(); notify('Choose meals from today’s menu before checking out.'); return; }
    lastDelivery = details;
    await prepareTrackedOrder(form, details);
  } catch (error) {
    if (dialog.open) notify(error.message);
  } finally {
    button.disabled = false;
  }
});
$('[data-instagram]').href = contact.instagram;
$('[data-call]').href = 'tel:' + contact.phone;
if (keepTodaysBag()) notify('Older meals were removed. Choose from today’s menu.');
else updateCart();
renderMenu();
trackFromHash();
