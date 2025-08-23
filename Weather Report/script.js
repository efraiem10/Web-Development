const API_KEY = "bc15408a5790c1d54de08e1b12d4f53c"; 
const BASE = "https://api.openweathermap.org/data/2.5";

const el = (id) => document.getElementById(id);
const q = el('q');
const msg = el('msg');
const unitBadge = el('unit');
const icon = el('icon');

let units = localStorage.getItem('units') || 'metric';
updateUnitButtons();

q.value = localStorage.getItem('lastCity') || '';

document.addEventListener('DOMContentLoaded', () => {
  if (q.value) {
    searchCity(q.value);
  } else {
    setMessage('Tip: Click “Use Location” or type a city to get started.', 'status');
  }
});

el('searchBtn').addEventListener('click', () => {
  const city = (q.value || '').trim();
  if (!city) return setMessage('Please enter a city name.', 'error');
  searchCity(city);
});

q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') el('searchBtn').click();
});

el('useLocation').addEventListener('click', () => {
  if (!navigator.geolocation) return setMessage('Geolocation is not supported in this browser.', 'error');
  setMessage('Detecting your location…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const data = await fetchJSON(`${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`);
      updateUIFromCurrent(data);
      localStorage.setItem('lastCity', data.name);
      const f = await fetchJSON(`${BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`);
      updateForecast(f);
      clearMessage();
    } catch (e) {
      setMessage('Failed to fetch weather for your location.', 'error');
    }
  }, () => setMessage('Location access denied. Type a city name instead.', 'error'), { enableHighAccuracy: true, timeout: 10000 });
});

el('cBtn').addEventListener('click', () => changeUnits('metric'));
el('fBtn').addEventListener('click', () => changeUnits('imperial'));

async function searchCity(city) {
  setMessage(`Searching weather for “${city}”…`);
  try {
    const data = await fetchJSON(`${BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${units}`);
    updateUIFromCurrent(data);
    localStorage.setItem('lastCity', data.name);
    const f = await fetchJSON(`${BASE}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${units}`);
    updateForecast(f);
    clearMessage();
  } catch (err) {
    if (err?.status === 404) setMessage('City not found. Please check the spelling and try again.', 'error');
    else setMessage('Something went wrong while fetching weather. Try again.', 'error');
  }
}

async function changeUnits(next) {
  if (units === next) return;
  units = next;
  localStorage.setItem('units', units);
  updateUnitButtons();
  unitBadge.textContent = units === 'metric' ? '°C' : '°F';
  const lastCity = localStorage.getItem('lastCity');
  if (lastCity) searchCity(lastCity);
}

function updateUnitButtons() {
  document.querySelector('#cBtn').classList.toggle('active', units === 'metric');
  document.querySelector('#fBtn').classList.toggle('active', units === 'imperial');
}

function setMessage(text, kind) {
  msg.textContent = text;
  msg.className = kind === 'error' ? 'meta error' : 'meta status';
}
function clearMessage(){ msg.textContent = ''; msg.className = 'meta'; }

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function updateUIFromCurrent(d) {
  const tzOffset = (d.timezone || 0) * 1000; // seconds -> ms
  const localTime = new Date(Date.now() + tzOffset - new Date().getTimezoneOffset()*60000);
  el('city').textContent = `${d.name}, ${d.sys?.country || ''}`;
  el('desc').textContent = titleCase(d.weather?.[0]?.description || '');
  el('time').textContent = `As of ${localTime.toLocaleString()}`;
  el('temp').textContent = Math.round(d.main?.temp);
  el('feels').textContent = fmtTemp(d.main?.feels_like);
  el('hum').textContent = `${d.main?.humidity ?? '—'}%`;
  el('wind').textContent = `${Math.round(d.wind?.speed ?? 0)} ${units === 'metric' ? 'm/s' : 'mph'}`;
  el('press').textContent = `${d.main?.pressure ?? '—'} hPa`;
  const iconCode = d.weather?.[0]?.icon || '01d';
  icon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  icon.alt = d.weather?.[0]?.main || 'weather icon';
  unitBadge.textContent = units === 'metric' ? '°C' : '°F';
}

function updateForecast(f) {
  
  const byDay = {};
  for (const item of f.list) {
    const dt = new Date(item.dt * 1000);
    const key = dt.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(item);
  }
  const days = Object.entries(byDay).slice(0,5);
  const html = days.map(([label, arr]) => {
    const temps = arr.map(x => x.main.temp);
    const min = Math.round(Math.min(...temps));
    const max = Math.round(Math.max(...temps));
    
    const midday = arr.find(x => new Date(x.dt * 1000).getHours() === 12) || arr[0];
    const iconCode = midday.weather?.[0]?.icon || '01d';
    const desc = titleCase(midday.weather?.[0]?.description || '');
    return `<div class="day" title="${desc}">
      <div class="d">${label}</div>
      <img src="https://openweathermap.org/img/wn/${iconCode}.png" alt="${desc}" />
      <div class="range">${max}° / ${min}°</div>
    </div>`
  }).join('');
  el('forecast').innerHTML = html;
}

function fmtTemp(t){ return (t === undefined || t === null) ? '—' : Math.round(t) + '°'; }
function titleCase(s){ return (s || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); }