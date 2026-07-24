const STORAGE_KEY = "simple-alarms";
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

let alarms = loadAlarms();
let selectedDays = new Set();
let ringingAlarmId = null;
let snoozeUntil = new Map();
let audioCtx = null;
let beepInterval = null;

const timeEl = document.getElementById("current-time");
const dateEl = document.getElementById("current-date");
const listEl = document.getElementById("alarm-list");
const emptyMsgEl = document.getElementById("empty-msg");
const timeInput = document.getElementById("alarm-time-input");
const labelInput = document.getElementById("alarm-label-input");
const addBtn = document.getElementById("add-alarm-btn");
const dayButtons = document.querySelectorAll(".day-btn");
const modal = document.getElementById("ringing-modal");
const ringingLabel = document.getElementById("ringing-label");
const ringingTime = document.getElementById("ringing-time");
const snoozeBtn = document.getElementById("snooze-btn");
const stopBtn = document.getElementById("stop-btn");
const saveNowBtn = document.getElementById("save-now-btn");
const saveStatusEl = document.getElementById("save-status");

function loadAlarms() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAlarms() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function updateClock() {
  const now = new Date();
  timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  dateEl.textContent = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  checkAlarms(now);
}

function checkAlarms(now) {
  if (ringingAlarmId !== null) return;
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const currentHM = `${hh}:${mm}`;
  const day = now.getDay();

  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    if (snoozeUntil.has(alarm.id)) {
      if (now.getTime() < snoozeUntil.get(alarm.id)) continue;
      snoozeUntil.delete(alarm.id);
    }
    const matchesDay = alarm.days.length === 0 || alarm.days.includes(day);
    if (alarm.time === currentHM && matchesDay && alarm.lastTriggered !== currentHM + "_" + now.toDateString()) {
      alarm.lastTriggered = currentHM + "_" + now.toDateString();
      triggerAlarm(alarm);
      saveAlarms();
      break;
    }
  }
}

function triggerAlarm(alarm) {
  ringingAlarmId = alarm.id;
  ringingLabel.textContent = alarm.label || "알람";
  ringingTime.textContent = alarm.time;
  modal.classList.remove("hidden");
  startBeep();
  briefAlarmNews();
}

function briefAlarmNews() {
  fetchRecentNews(NEWS_SEARCH_KEYWORD, 3)
    .then((data) => {
      const items = data.items || [];
      renderNewsBriefing(items);
      speakBriefing(buildBriefingText(items));
    })
    .catch(() => {});
}

function startBeep() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  stopBeep();
  const playBeep = () => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  };
  playBeep();
  beepInterval = setInterval(playBeep, 600);
}

function stopBeep() {
  if (beepInterval) {
    clearInterval(beepInterval);
    beepInterval = null;
  }
}

function stopRinging() {
  const id = ringingAlarmId;
  ringingAlarmId = null;
  modal.classList.add("hidden");
  stopBeep();
  stopBriefing();
  return id;
}

stopBtn.addEventListener("click", () => {
  stopRinging();
});

snoozeBtn.addEventListener("click", () => {
  const id = stopRinging();
  if (id !== null) {
    snoozeUntil.set(id, Date.now() + 5 * 60 * 1000);
  }
});

saveNowBtn.addEventListener("click", async () => {
  saveStatusEl.textContent = "저장 중...";
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ alarms }),
    });
    const data = await res.json();
    if (data.result === "success") {
      const now = new Date();
      const timeLabel = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      saveStatusEl.textContent = `저장되었습니다 (${timeLabel})`;
    } else {
      saveStatusEl.textContent = "저장에 실패했습니다";
    }
  } catch {
    saveStatusEl.textContent = "저장에 실패했습니다";
  }
});

dayButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const day = Number(btn.dataset.day);
    if (selectedDays.has(day)) {
      selectedDays.delete(day);
      btn.classList.remove("active");
    } else {
      selectedDays.add(day);
      btn.classList.add("active");
    }
  });
});

addBtn.addEventListener("click", () => {
  const time = timeInput.value;
  if (!time) {
    timeInput.focus();
    return;
  }
  const alarm = {
    id: Date.now(),
    time,
    label: labelInput.value.trim(),
    days: Array.from(selectedDays).sort(),
    enabled: true,
    lastTriggered: null,
  };
  alarms.push(alarm);
  alarms.sort((a, b) => a.time.localeCompare(b.time));
  saveAlarms();
  renderAlarms();

  timeInput.value = "";
  labelInput.value = "";
  selectedDays.clear();
  dayButtons.forEach((b) => b.classList.remove("active"));
});

function renderAlarms() {
  listEl.innerHTML = "";
  emptyMsgEl.style.display = alarms.length === 0 ? "block" : "none";

  for (const alarm of alarms) {
    const li = document.createElement("li");
    li.className = "alarm-item" + (alarm.enabled ? "" : " disabled");

    const info = document.createElement("div");
    info.className = "alarm-info";

    const timeDiv = document.createElement("div");
    timeDiv.className = "alarm-time";
    timeDiv.textContent = alarm.time;
    info.appendChild(timeDiv);

    if (alarm.label) {
      const labelDiv = document.createElement("div");
      labelDiv.className = "alarm-label";
      labelDiv.textContent = alarm.label;
      info.appendChild(labelDiv);
    }

    if (alarm.days.length > 0) {
      const daysDiv = document.createElement("div");
      daysDiv.className = "alarm-days";
      daysDiv.textContent = alarm.days.map((d) => DAY_LABELS[d]).join(" ");
      info.appendChild(daysDiv);
    }

    const label = document.createElement("label");
    label.className = "switch";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = alarm.enabled;
    checkbox.addEventListener("change", () => {
      alarm.enabled = checkbox.checked;
      saveAlarms();
      renderAlarms();
    });
    const slider = document.createElement("span");
    slider.className = "slider";
    label.appendChild(checkbox);
    label.appendChild(slider);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", () => {
      alarms = alarms.filter((a) => a.id !== alarm.id);
      saveAlarms();
      renderAlarms();
    });

    li.appendChild(info);
    li.appendChild(label);
    li.appendChild(deleteBtn);
    listEl.appendChild(li);
  }
}

renderAlarms();
updateClock();
setInterval(updateClock, 1000);

const WEATHER_API_KEY = "b9f79360b1c7d1b18a707adaa497c381";
const WEATHER_LAT = 37.5665;
const WEATHER_LON = 126.9780;
const weatherEl = document.getElementById("weather");

async function updateWeather() {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${WEATHER_LAT}&lon=${WEATHER_LON}&appid=${WEATHER_API_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("weather fetch failed");
    const data = await res.json();
    weatherEl.textContent = `현재 기온: ${Math.round(data.main.temp)}°C · 습도: ${data.main.humidity}%`;
  } catch {
    weatherEl.textContent = "기온 정보를 불러올 수 없습니다.";
  }
}

updateWeather();
setInterval(updateWeather, 10 * 60 * 1000);
