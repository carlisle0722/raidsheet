const minItemLevel = 1700;
const storageKeys = {
  accounts: "raidsheet:accounts:v3",
  legacyAccounts: "raidsheet:accounts:v2",
  assignments: "raidsheet:assignments:v2",
};

const defaultAccounts = [
  { id: "kkul", owner: "꿀숑", queryName: "꿀숑", label: "꿀숑" },
  { id: "bluesong", owner: "꿀숑", queryName: "블숑몬", label: "블숑몬" },
  { id: "mineumon", owner: "미느몬", queryName: "미느몬", label: "미느몬" },
  { id: "kimsamdae", owner: "김삼대", queryName: "김삼대", label: "김삼대" },
  { id: "badeulbageulbadeul", owner: "바들바글바들", queryName: "바들바글바들", label: "바들바글바들" },
  { id: "ddiddu", owner: "디뚜뚜뚜", queryName: "디뚜뚜뚜", label: "디뚜뚜뚜" },
];

const state = {
  accounts: loadAccounts(),
  rosters: [],
  assignments: loadAssignments(),
  isLoading: false,
  isRemoteReady: false,
  lastUpdatedAt: null,
};

const elements = {
  refreshButton: document.querySelector("#refresh-button"),
  editAccountsButton: document.querySelector("#edit-accounts-button"),
  openRosterButton: document.querySelector("#open-roster-button"),
  accountsDialog: document.querySelector("#accounts-dialog"),
  rosterDialog: document.querySelector("#roster-dialog"),
  accountEditor: document.querySelector("#account-editor"),
  addAccountButton: document.querySelector("#add-account-button"),
  saveAccountsButton: document.querySelector("#save-accounts-button"),
  status: document.querySelector("#status"),
  assignmentBoard: document.querySelector("#assignment-board"),
  rosterBoard: document.querySelector("#roster-board"),
  ownerCount: document.querySelector("#owner-count"),
  characterTotal: document.querySelector("#character-total"),
  assignedTotal: document.querySelector("#assigned-total"),
  ownerTemplate: document.querySelector("#owner-column-template"),
  sourceTemplate: document.querySelector("#source-column-template"),
  characterTemplate: document.querySelector("#character-card-template"),
};

elements.refreshButton.addEventListener("click", () => loadRosters({ refresh: true }));
elements.editAccountsButton.addEventListener("click", openAccountEditor);
elements.openRosterButton.addEventListener("click", openRosterDialog);
elements.addAccountButton.addEventListener("click", addAccountEditorRow);
elements.saveAccountsButton.addEventListener("click", saveAccountEditor);

renderAll();
initializeApp();

async function initializeApp() {
  await loadSheetState();
  await loadRosters();
}

async function loadRosters(options = {}) {
  if (state.isLoading) return;

  state.isLoading = true;
  elements.refreshButton.disabled = true;
  setStatus(options.refresh ? "새로 조회 중" : "자동 조회 중", "loading");
  renderRosterBoard(true);

  const results = await Promise.all(state.accounts.map((account) => fetchAccountRoster(account, options)));
  state.rosters = results;
  state.lastUpdatedAt = new Date();
  state.isLoading = false;
  elements.refreshButton.disabled = false;

  pruneAssignments();
  renderAll();
  renderStatus();
}

async function fetchAccountRoster(account, options = {}) {
  const params = new URLSearchParams({ characterName: account.queryName });
  if (options.refresh) params.set("refresh", "1");

  try {
    const response = await fetch(`/api/roster?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "조회에 실패했습니다.");

    const characters = payload.characters
      .filter((character) => character.itemLevelNumber >= minItemLevel)
      .map((character) => ({
        ...character,
        sourceAccountId: account.id,
        sourceAccountLabel: account.label,
        defaultOwner: account.owner,
        key: characterKey(character),
      }));

    return {
      account,
      ok: true,
      cached: payload.cached,
      characters,
    };
  } catch (error) {
    return {
      account,
      ok: false,
      error: error.message,
      characters: [],
    };
  }
}

function renderAll() {
  renderSummary();
  renderAssignmentBoard();
  renderRosterBoard();
}

function renderSummary() {
  elements.ownerCount.textContent = `${getOwners().length}명`;
  elements.characterTotal.textContent = getAllCharacters().length.toLocaleString("ko-KR");
  elements.assignedTotal.textContent = state.assignments.length.toLocaleString("ko-KR");
}

function renderAssignmentBoard() {
  const owners = getOwners();
  const charactersByKey = new Map(getAllCharacters().map((character) => [character.key, character]));

  const columns = owners.map((owner) => {
    const fragment = elements.ownerTemplate.content.cloneNode(true);
    const column = fragment.querySelector(".owner-column");
    const list = column.querySelector(".assignment-list");
    const assigned = state.assignments
      .filter((assignment) => assignment.owner === owner)
      .map((assignment) => charactersByKey.get(assignment.key) ?? assignment.character)
      .filter(Boolean)
      .sort(compareCharacters);

    column.querySelector("h3").textContent = owner;
    column.querySelector(".owner-count").textContent = `${assigned.length}`;

    if (!assigned.length) {
      const message = document.createElement("p");
      message.className = "column-message";
      message.textContent = "편성된 캐릭터 없음";
      list.replaceChildren(message);
      return column;
    }

    list.replaceChildren(...assigned.map((character) => createCharacterCard(character, "assigned", owner)));
    return column;
  });

  elements.assignmentBoard.replaceChildren(...columns);
}

function renderRosterBoard(isLoading = false) {
  const accountGroups = getAccountGroups();

  if (isLoading && !state.rosters.length) {
    elements.rosterBoard.replaceChildren(...accountGroups.map(createLoadingSourceColumn));
    return;
  }

  const columns = accountGroups.map((group) => {
    const rosters = group.accounts
      .map((account) => state.rosters.find((item) => item.account.id === account.id))
      .filter(Boolean);
    const fragment = elements.sourceTemplate.content.cloneNode(true);
    const column = fragment.querySelector(".source-column");
    const list = column.querySelector(".character-list");

    column.querySelector("h3").textContent = group.owner;
    column.querySelector(".source-meta").textContent = getAccountGroupMeta(group);

    if (state.isLoading && rosters.length < group.accounts.length) {
      column.querySelector(".source-count").textContent = "-";
      list.replaceChildren(...Array.from({ length: 5 }, createSkeletonRow));
      return column;
    }

    const failed = rosters.filter((roster) => !roster.ok);
    const characters = uniqueCharacters(rosters.flatMap((roster) => (roster.ok ? roster.characters : []))).sort(
      compareCharacters,
    );

    if (failed.length && !characters.length) {
      column.querySelector(".source-count").textContent = "오류";
      const message = document.createElement("p");
      message.className = "column-message is-error";
      message.textContent = failed.map((roster) => `${roster.account.label}: ${roster.error}`).join(" / ");
      list.replaceChildren(message);
      return column;
    }

    column.querySelector(".source-count").textContent = `${characters.length}`;
    const listItems = [];

    if (failed.length) {
      const message = document.createElement("p");
      message.className = "column-message is-error";
      message.textContent = failed.map((roster) => `${roster.account.label}: ${roster.error}`).join(" / ");
      listItems.push(message);
    }

    if (!characters.length) {
      const message = document.createElement("p");
      message.className = "column-message";
      message.textContent = `${minItemLevel}+ 캐릭터 없음`;
      list.replaceChildren(message);
      return column;
    }

    listItems.push(...characters.map((character) => createCharacterCard(character, "pool")));
    list.replaceChildren(...listItems);
    return column;
  });

  elements.rosterBoard.replaceChildren(...columns);
}

function createLoadingSourceColumn(group) {
  const fragment = elements.sourceTemplate.content.cloneNode(true);
  const column = fragment.querySelector(".source-column");
  column.querySelector("h3").textContent = group.owner;
  column.querySelector(".source-meta").textContent = getAccountGroupMeta(group);
  column.querySelector(".source-count").textContent = "-";
  column.querySelector(".character-list").replaceChildren(...Array.from({ length: 5 }, createSkeletonRow));
  return column;
}

function createCharacterCard(character, mode, assignedOwner = "") {
  const fragment = elements.characterTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".character-card");
  const actions = card.querySelector(".character-actions");
  const isAssigned = state.assignments.some((assignment) => assignment.key === character.key);

  card.dataset.tier = getLevelTier(character.itemLevelNumber);
  card.querySelector(".character-name").textContent = character.characterName;
  card.querySelector(".class-name").textContent = character.characterClassName;
  card.querySelector(".source-owner").textContent = character.sourceAccountLabel
    ? character.sourceAccountLabel === character.defaultOwner
      ? character.sourceAccountLabel
      : `${character.sourceAccountLabel} · ${character.defaultOwner}`
    : character.serverName;
  card.querySelector(".item-level").textContent = character.itemAvgLevel;

  if (mode === "assigned") {
    const ownerSelect = createOwnerSelect(assignedOwner);
    ownerSelect.addEventListener("change", () => moveAssignment(character, ownerSelect.value));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-character-button";
    removeButton.setAttribute("aria-label", `${character.characterName} 제외`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => removeAssignment(character.key));

    actions.replaceChildren(ownerSelect, removeButton);
    return card;
  }

  const ownerSelect = createOwnerSelect(character.defaultOwner);
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "small-button";
  addButton.textContent = isAssigned ? "편성됨" : "추가";
  addButton.disabled = isAssigned;
  addButton.addEventListener("click", () => addAssignment(character, ownerSelect.value));

  actions.replaceChildren(ownerSelect, addButton);
  return card;
}

function createOwnerSelect(selectedOwner) {
  const select = document.createElement("select");
  select.className = "owner-select";
  for (const owner of getOwners()) {
    select.add(new Option(owner, owner, owner === selectedOwner, owner === selectedOwner));
  }
  return select;
}

function addAssignment(character, owner) {
  if (state.assignments.some((assignment) => assignment.key === character.key)) return;
  state.assignments.push({
    key: character.key,
    owner,
    character,
  });
  saveAssignments();
  saveSheetState();
  renderAll();
}

function moveAssignment(character, owner) {
  const assignment = state.assignments.find((item) => item.key === character.key);
  if (!assignment) return;
  assignment.owner = owner;
  assignment.character = character;
  saveAssignments();
  saveSheetState();
  renderAll();
}

function removeAssignment(key) {
  state.assignments = state.assignments.filter((assignment) => assignment.key !== key);
  saveAssignments();
  saveSheetState();
  renderAll();
}

function pruneAssignments() {
  const knownKeys = new Set(getAllCharacters().map((character) => character.key));
  const previousLength = state.assignments.length;
  state.assignments = state.assignments.filter((assignment) => knownKeys.has(assignment.key));
  if (state.assignments.length !== previousLength) {
    saveAssignments();
    saveSheetState();
  }
}

function openAccountEditor() {
  elements.accountEditor.replaceChildren();
  for (const account of state.accounts) {
    addAccountEditorRow(account);
  }
  elements.accountsDialog.showModal();
}

function openRosterDialog() {
  elements.rosterDialog.showModal();
}

function addAccountEditorRow(account = {}) {
  const row = document.createElement("div");
  row.className = "account-row";
  row.innerHTML = `
    <label>캐릭터명<input data-field="queryName" type="text" value="${escapeAttribute(account.queryName ?? account.label ?? "")}" placeholder="대표 캐릭터명" /></label>
    <label>소속<input data-field="owner" type="text" value="${escapeAttribute(account.owner ?? "")}" placeholder="편성표 사람 이름" /></label>
    <button class="small-button danger" type="button">삭제</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  elements.accountEditor.append(row);
}

function saveAccountEditor() {
  const rows = [...elements.accountEditor.querySelectorAll(".account-row")];
  const nextAccounts = rows
    .map((row, index) => {
      const queryName = row.querySelector('[data-field="queryName"]').value.trim();
      const owner = row.querySelector('[data-field="owner"]').value.trim();
      if (!queryName || !owner) return null;
      return {
        id: stableAccountId(queryName, queryName, index),
        label: queryName,
        queryName,
        owner,
      };
    })
    .filter(Boolean);

  if (!nextAccounts.length) {
    setStatus("계정을 최소 1개 이상 입력해 주세요.", "error");
    return;
  }

  state.accounts = nextAccounts;
  saveAccounts();
  saveSheetState();
  elements.accountsDialog.close();
  loadRosters({ refresh: true });
}

function renderStatus() {
  const failed = state.rosters.filter((roster) => !roster.ok);
  if (failed.length) {
    setStatus(`${failed.length}개 계정 조회 실패`, "error");
    return;
  }

  const total = getAllCharacters().length;
  const cachedCount = state.rosters.filter((roster) => roster.cached).length;
  const time = state.lastUpdatedAt?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const cacheText = cachedCount ? ` · 캐시 ${cachedCount}건` : "";
  setStatus(`${time} 기준 ${minItemLevel}+ ${total}명 조회${cacheText}`, "success");
}

function setStatus(message, tone = "neutral") {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function getAllCharacters() {
  return uniqueCharacters(state.rosters.flatMap((roster) => (roster.ok ? roster.characters : [])));
}

function getOwners() {
  return [...new Set(state.accounts.map((account) => account.owner).filter(Boolean))];
}

function getAccountGroups() {
  const groups = new Map();

  for (const account of state.accounts) {
    const owner = account.owner || account.label || account.queryName;
    if (!owner) continue;

    if (!groups.has(owner)) {
      groups.set(owner, { owner, accounts: [] });
    }

    groups.get(owner).accounts.push(account);
  }

  return Array.from(groups.values());
}

function getAccountGroupMeta(group) {
  const queryNames = [...new Set(group.accounts.map((account) => account.queryName).filter(Boolean))];
  return `조회: ${queryNames.join(", ")}`;
}

function uniqueCharacters(characters) {
  const charactersByKey = new Map();

  for (const character of characters) {
    const key = character.key ?? characterKey(character);
    if (!charactersByKey.has(key)) {
      charactersByKey.set(key, character);
    }
  }

  return Array.from(charactersByKey.values());
}

function compareCharacters(a, b) {
  return b.itemLevelNumber - a.itemLevelNumber || a.characterName.localeCompare(b.characterName, "ko-KR");
}

function characterKey(character) {
  return `${character.serverName}:${character.characterName}`;
}

function getLevelTier(level) {
  if (level >= 1750) return "ancient";
  if (level >= 1740) return "red";
  if (level >= 1730) return "green";
  if (level >= 1720) return "blue";
  if (level >= 1710) return "gray";
  return "low";
}

function createSkeletonRow() {
  const row = document.createElement("div");
  row.className = "character-card is-skeleton";
  row.innerHTML = "<span></span><span></span>";
  return row;
}

function loadAccounts() {
  const savedAccounts = normalizeAccounts(readJson(storageKeys.accounts, null));
  if (savedAccounts.length) return savedAccounts;

  const legacyAccounts = normalizeAccounts(readJson(storageKeys.legacyAccounts, null));
  if (legacyAccounts.length) return mergeDefaultAccounts(legacyAccounts);

  return defaultAccounts;
}

function saveAccounts() {
  localStorage.setItem(storageKeys.accounts, JSON.stringify(state.accounts));
}

function loadAssignments() {
  return readJson(storageKeys.assignments, []);
}

function saveAssignments() {
  localStorage.setItem(storageKeys.assignments, JSON.stringify(state.assignments));
}

async function loadSheetState() {
  try {
    const response = await fetch("/api/state");

    if (!response.ok) {
      throw new Error("remote state unavailable");
    }

    const payload = await response.json();
    const remoteAccounts = normalizeAccounts(payload.accounts);
    const remoteAssignments = normalizeAssignments(payload.assignments);

    state.accounts = remoteAccounts.length ? remoteAccounts : state.accounts;
    if (Array.isArray(payload.assignments)) {
      state.assignments = remoteAssignments;
    }
    state.isRemoteReady = true;

    saveAccounts();
    saveAssignments();
    renderAll();

    if (!payload.exists) {
      saveSheetState();
    }
  } catch {
    state.isRemoteReady = false;
  }
}

async function saveSheetState() {
  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        accounts: state.accounts,
        assignments: state.assignments,
      }),
    });

    state.isRemoteReady = response.ok;
  } catch {
    state.isRemoteReady = false;
  }
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeAccounts(accounts) {
  if (!Array.isArray(accounts)) return [];

  return accounts
    .map((account, index) => {
      const label = String(account?.label ?? "").trim();
      const queryName = String(account?.queryName ?? "").trim();
      const owner = String(account?.owner ?? "").trim();
      if (!queryName || !owner) return null;

      return {
        id: String(account?.id ?? `account-${index}`).trim() || `account-${index}`,
        label: label || queryName,
        queryName,
        owner,
      };
    })
    .filter(Boolean);
}

function normalizeAssignments(assignments) {
  if (!Array.isArray(assignments)) return [];

  return assignments
    .map((assignment) => {
      const key = String(assignment?.key ?? "").trim();
      const owner = String(assignment?.owner ?? "").trim();
      if (!key || !owner || !assignment?.character) return null;

      return {
        key,
        owner,
        character: assignment.character,
      };
    })
    .filter(Boolean);
}

function mergeDefaultAccounts(accounts) {
  const defaultQueryNames = new Set(defaultAccounts.map((account) => account.queryName));
  const customAccounts = accounts.filter((account) => !defaultQueryNames.has(account.queryName));
  return [...defaultAccounts, ...customAccounts];
}

function stableAccountId(label, queryName, index) {
  const existing = state.accounts.find((account) => account.label === label && account.queryName === queryName);
  if (existing) return existing.id;
  return `${label}-${queryName}-${index}`.replace(/\s+/g, "-");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
