const state = {
  lastCharacterName: "",
  roster: null,
};

const elements = {
  form: document.querySelector("#search-form"),
  input: document.querySelector("#character-name"),
  searchButton: document.querySelector("#search-button"),
  refreshButton: document.querySelector("#refresh-button"),
  status: document.querySelector("#status"),
  result: document.querySelector("#result"),
  resultTitle: document.querySelector("#result-title"),
  resultLabel: document.querySelector("#result-label"),
  metricTotal: document.querySelector("#metric-total"),
  metricHighestLevel: document.querySelector("#metric-highest-level"),
  metricServer: document.querySelector("#metric-server"),
  serverFilter: document.querySelector("#server-filter"),
  classFilter: document.querySelector("#class-filter"),
  sortSelect: document.querySelector("#sort-select"),
  chips: document.querySelector("#chips"),
  characterGrid: document.querySelector("#character-grid"),
  emptyResult: document.querySelector("#empty-result"),
  template: document.querySelector("#character-card-template"),
};

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  search(elements.input.value);
});

elements.refreshButton.addEventListener("click", () => {
  if (state.lastCharacterName) {
    search(state.lastCharacterName, { refresh: true });
  }
});

for (const control of [elements.serverFilter, elements.classFilter, elements.sortSelect]) {
  control.addEventListener("change", renderCharacters);
}

const recentSearch = localStorage.getItem("lostark:lastCharacterName");
if (recentSearch) {
  elements.input.value = recentSearch;
}

async function search(characterName, options = {}) {
  const trimmedName = characterName.trim();
  if (!trimmedName) {
    setStatus("캐릭터명을 입력해 주세요.", "error");
    elements.input.focus();
    return;
  }

  state.lastCharacterName = trimmedName;
  localStorage.setItem("lostark:lastCharacterName", trimmedName);
  setLoading(true);
  setStatus("원정대 정보를 불러오는 중입니다.", "loading");

  const params = new URLSearchParams({ characterName: trimmedName });
  if (options.refresh) {
    params.set("refresh", "1");
  }

  try {
    const response = await fetch(`/api/roster?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "검색에 실패했습니다.");
    }

    state.roster = payload;
    populateFilters(payload.characters);
    renderSummary(payload);
    renderDistribution(payload.summary);
    renderCharacters();
    elements.result.hidden = false;

    const suffix = payload.cached ? "캐시된 결과입니다." : formatRateLimit(payload.rateLimit);
    setStatus(`${payload.total}명의 캐릭터를 찾았습니다. ${suffix}`.trim(), "success");
  } catch (error) {
    state.roster = null;
    elements.result.hidden = true;
    setStatus(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function renderSummary(payload) {
  const highest = payload.summary.highest;
  const topServer = payload.summary.servers[0];

  elements.resultLabel.textContent = `${payload.queriedCharacterName} 기준`;
  elements.resultTitle.textContent = "원정대 캐릭터";
  elements.metricTotal.textContent = payload.total.toLocaleString("ko-KR");
  elements.metricHighestLevel.textContent = highest ? highest.itemAvgLevel : "-";
  elements.metricServer.textContent = topServer ? `${topServer.name} ${topServer.count}명` : "-";
}

function renderDistribution(summary) {
  const serverChips = summary.servers.map((item) => ({ ...item, type: "서버" }));
  const classChips = summary.classes.slice(0, 8).map((item) => ({ ...item, type: "직업" }));
  const chips = [...serverChips, ...classChips];

  elements.chips.replaceChildren(
    ...chips.map((item) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${item.type} ${item.name} ${item.count}`;
      return chip;
    }),
  );
}

function renderCharacters() {
  if (!state.roster) {
    return;
  }

  const server = elements.serverFilter.value;
  const characterClass = elements.classFilter.value;
  const sortBy = elements.sortSelect.value;

  const filtered = state.roster.characters
    .filter((character) => server === "all" || character.serverName === server)
    .filter((character) => characterClass === "all" || character.characterClassName === characterClass)
    .sort((a, b) => compareCharacters(a, b, sortBy));

  const cards = filtered.map(createCharacterCard);
  elements.characterGrid.replaceChildren(...cards);
  elements.emptyResult.hidden = filtered.length > 0;
}

function createCharacterCard(character) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector(".character-card");
  card.querySelector(".server").textContent = character.serverName;
  card.querySelector(".combat-level").textContent = character.characterLevel ? `전투 Lv.${character.characterLevel}` : "전투 Lv.-";
  card.querySelector("h3").textContent = character.characterName;
  card.querySelector(".class-name").textContent = character.characterClassName;
  card.querySelector(".item-level strong").textContent = character.itemAvgLevel;
  return card;
}

function populateFilters(characters) {
  const servers = unique(characters.map((character) => character.serverName));
  const classes = unique(characters.map((character) => character.characterClassName));

  replaceOptions(elements.serverFilter, servers);
  replaceOptions(elements.classFilter, classes);
  elements.sortSelect.value = "level-desc";
}

function replaceOptions(select, values) {
  select.replaceChildren(new Option("전체", "all"));
  for (const value of values) {
    select.add(new Option(value, value));
  }
}

function compareCharacters(a, b, sortBy) {
  if (sortBy === "level-asc") {
    return a.itemLevelNumber - b.itemLevelNumber || byName(a, b);
  }

  if (sortBy === "name-asc") {
    return byName(a, b);
  }

  if (sortBy === "server-asc") {
    return a.serverName.localeCompare(b.serverName, "ko-KR") || byName(a, b);
  }

  return b.itemLevelNumber - a.itemLevelNumber || byName(a, b);
}

function byName(a, b) {
  return a.characterName.localeCompare(b.characterName, "ko-KR");
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ko-KR"));
}

function setLoading(isLoading) {
  elements.searchButton.disabled = isLoading;
  elements.refreshButton.disabled = isLoading;
  elements.searchButton.textContent = isLoading ? "검색 중" : "검색";
}

function setStatus(message, tone = "neutral") {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function formatRateLimit(rateLimit) {
  if (!rateLimit?.remaining) {
    return "";
  }

  return `남은 요청 ${rateLimit.remaining}/${rateLimit.limit ?? "100"}`;
}
