const targetServer = "카단";

const members = [
  { id: "kkul", label: "꿀숑", queryName: "꿀숑" },
  { id: "mineu", label: "미느몬", queryName: "미느몬" },
  { id: "samdae", label: "김삼대", queryName: "김삼대" },
  { id: "badeul", label: "바들바글바들", queryName: "바들바글바들" },
  { id: "ddiddu", label: "디뚜뚜뚜", queryName: "디뚜뚜뚜" },
];

const state = {
  rosters: [],
  isLoading: false,
  lastUpdatedAt: null,
};

const elements = {
  refreshButton: document.querySelector("#refresh-button"),
  status: document.querySelector("#status"),
  rosterBoard: document.querySelector("#roster-board"),
  characterTotal: document.querySelector("#character-total"),
  highestLevel: document.querySelector("#highest-level"),
  memberCount: document.querySelector("#member-count"),
  memberTemplate: document.querySelector("#member-column-template"),
  characterTemplate: document.querySelector("#character-row-template"),
};

elements.memberCount.textContent = `${members.length}명`;
elements.refreshButton.addEventListener("click", () => loadRosters({ refresh: true }));

renderLoadingColumns();
loadRosters();

async function loadRosters(options = {}) {
  if (state.isLoading) {
    return;
  }

  state.isLoading = true;
  setStatus(options.refresh ? "새로 조회 중" : "자동 조회 중", "loading");
  elements.refreshButton.disabled = true;

  if (!state.rosters.length) {
    renderLoadingColumns();
  }

  const results = await Promise.all(members.map((member) => fetchMemberRoster(member, options)));

  state.rosters = results;
  state.lastUpdatedAt = new Date();
  state.isLoading = false;
  elements.refreshButton.disabled = false;

  renderBoard();
  renderSummary();
  renderStatus();
}

async function fetchMemberRoster(member, options = {}) {
  const params = new URLSearchParams({
    characterName: member.queryName,
    serverName: targetServer,
  });

  if (options.refresh) {
    params.set("refresh", "1");
  }

  try {
    const response = await fetch(`/api/roster?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "조회에 실패했습니다.");
    }

    return {
      member,
      ok: true,
      cached: payload.cached,
      rateLimit: payload.rateLimit,
      characters: payload.characters,
      total: payload.total,
    };
  } catch (error) {
    return {
      member,
      ok: false,
      cached: false,
      error: error.message,
      characters: [],
      total: 0,
    };
  }
}

function renderLoadingColumns() {
  elements.rosterBoard.replaceChildren(
    ...members.map((member) => {
      const column = createMemberColumn({
        member,
        ok: true,
        loading: true,
        characters: [],
      });
      return column;
    }),
  );
}

function renderBoard() {
  const columns = state.rosters.map((roster) => createMemberColumn(roster));
  elements.rosterBoard.replaceChildren(...columns);
}

function createMemberColumn(roster) {
  const fragment = elements.memberTemplate.content.cloneNode(true);
  const column = fragment.querySelector(".member-column");
  const title = column.querySelector("h3");
  const queryName = column.querySelector(".query-name");
  const count = column.querySelector(".member-count");
  const list = column.querySelector(".character-list");

  title.textContent = roster.member.label;
  queryName.textContent = roster.member.queryName;

  if (roster.loading) {
    count.textContent = "-";
    list.replaceChildren(...Array.from({ length: 6 }, createSkeletonRow));
    return column;
  }

  if (!roster.ok) {
    count.textContent = "오류";
    const message = document.createElement("p");
    message.className = "column-message is-error";
    message.textContent = roster.error;
    list.replaceChildren(message);
    return column;
  }

  const characters = [...roster.characters].sort(
    (a, b) => b.itemLevelNumber - a.itemLevelNumber || a.characterName.localeCompare(b.characterName, "ko-KR"),
  );

  count.textContent = `${characters.length}개`;

  if (!characters.length) {
    const message = document.createElement("p");
    message.className = "column-message";
    message.textContent = "카단 캐릭터 없음";
    list.replaceChildren(message);
    return column;
  }

  list.replaceChildren(...characters.map(createCharacterRow));
  return column;
}

function createCharacterRow(character) {
  const fragment = elements.characterTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".character-row");

  row.dataset.tier = getLevelTier(character.itemLevelNumber);
  row.querySelector(".character-name").textContent = character.characterName;
  row.querySelector(".class-name").textContent = character.characterClassName;
  row.querySelector(".combat-level").textContent = character.characterLevel
    ? `전투 Lv.${character.characterLevel}`
    : "전투 Lv.-";
  row.querySelector(".item-level").textContent = character.itemAvgLevel;

  return row;
}

function createSkeletonRow() {
  const row = document.createElement("div");
  row.className = "character-row is-skeleton";
  row.innerHTML = '<span></span><span></span>';
  return row;
}

function renderSummary() {
  const characters = state.rosters.flatMap((roster) => roster.characters);
  const highest = characters.reduce(
    (best, character) => (!best || character.itemLevelNumber > best.itemLevelNumber ? character : best),
    null,
  );

  elements.characterTotal.textContent = characters.length.toLocaleString("ko-KR");
  elements.highestLevel.textContent = highest ? highest.itemAvgLevel : "-";
}

function renderStatus() {
  const failed = state.rosters.filter((roster) => !roster.ok);
  if (failed.length) {
    setStatus(`${failed.length}명 조회 실패`, "error");
    return;
  }

  const total = state.rosters.reduce((sum, roster) => sum + roster.characters.length, 0);
  const cachedCount = state.rosters.filter((roster) => roster.cached).length;
  const time = state.lastUpdatedAt?.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const cacheText = cachedCount ? `, 캐시 ${cachedCount}건` : "";

  setStatus(`${time} 기준 ${total}개 조회${cacheText}`, "success");
}

function setStatus(message, tone = "neutral") {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function getLevelTier(level) {
  if (level >= 1750) return "ancient";
  if (level >= 1740) return "red";
  if (level >= 1730) return "green";
  if (level >= 1720) return "blue";
  if (level >= 1710) return "gray";
  return "low";
}
