const NEWS_SEARCH_KEYWORD = "최신뉴스";

function stripHtmlTags(str) {
  const withoutTags = String(str).replace(/<[^>]*>/g, "");
  const textarea = document.createElement("textarea");
  textarea.innerHTML = withoutTags;
  return textarea.value;
}

function buildPubDateLabel(pubDate) {
  const date = new Date(pubDate);
  return date.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildNewsCard(item) {
  const card = document.createElement("li");
  card.className = "news-card";

  const title = document.createElement("div");
  title.className = "news-card-title";
  title.textContent = stripHtmlTags(item.title);

  const desc = document.createElement("div");
  desc.className = "news-card-desc";
  desc.textContent = stripHtmlTags(item.description);

  const meta = document.createElement("div");
  meta.className = "news-card-meta";
  meta.textContent = buildPubDateLabel(item.pubDate);

  const link = document.createElement("a");
  link.className = "news-card-link";
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "원문보기";

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(meta);
  card.appendChild(link);

  return card;
}

function renderNewsList(items) {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  items.forEach((item) => {
    listEl.appendChild(buildNewsCard(item));
  });
}

function renderNewsMessage(message) {
  const listEl = document.getElementById("news-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  const li = document.createElement("li");
  li.className = "news-message";
  li.textContent = message;
  listEl.appendChild(li);
}

function renderNewsBriefing(items) {
  const listEl = document.getElementById("briefing-news-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  items.forEach((item) => {
    listEl.appendChild(buildNewsCard(item));
  });
}

const ORDINAL_LABELS = ["첫번째", "두번째", "세번째", "네번째", "다섯번째"];

function buildBriefingText(items) {
  return items
    .map((item, index) => {
      const ordinal = ORDINAL_LABELS[index] || `${index + 1}번째`;
      return `${ordinal} 뉴스, ${stripHtmlTags(item.title)}.`;
    })
    .join(" ");
}

let lastBriefingText = "";
let currentUtterance = null;

function speakBriefing(text) {
  lastBriefingText = text;
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang = "ko-KR";
  speechSynthesis.speak(currentUtterance);
}

function stopBriefing() {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
}

async function fetchRecentNews(keyword, count = 5) {
  const res = await fetch(SUPABASE_NEWS_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ keyword }),
  });

  if (!res.ok) {
    throw new Error("news fetch failed");
  }

  const data = await res.json();
  return { ...data, items: (data.items || []).slice(0, count) };
}

const briefingPlayBtn = document.getElementById("briefing-play-btn");
if (briefingPlayBtn) {
  if (!("speechSynthesis" in window)) {
    briefingPlayBtn.style.display = "none";
  } else {
    briefingPlayBtn.addEventListener("click", () => {
      speakBriefing(lastBriefingText);
    });
  }
}

const newsToggleBtn = document.getElementById("show-news-btn");
if (newsToggleBtn) {
  newsToggleBtn.addEventListener("click", async () => {
    renderNewsMessage("불러오는 중...");
    try {
      const data = await fetchRecentNews(NEWS_SEARCH_KEYWORD);
      renderNewsList(data.items || []);
    } catch {
      renderNewsMessage("뉴스를 불러오지 못했습니다.");
    }
  });
}
