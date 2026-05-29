const minItemLevel = 1700;
const storageKeys = {
  accounts: "raidsheet:accounts:v4",
  legacyAccounts: "raidsheet:accounts:v3",
  assignments: "raidsheet:assignments:v2",
  raidPlans: "raidsheet:raid-plans:v1",
};

const names = {
  kkul: "\uAFC0\uC211",
  mineumon: "\uBBF8\uB290\uBAAC",
  kimsamdae: "\uAE40\uC0BC\uB300",
  badeulbageulbadeul: "\uBC14\uB4E4\uBC14\uAE00\uBC14\uB4E4",
  ddiddu: "\uB514\uB69C\uB69C\uB69C",
};

const defaultAvatars = {
  [names.kkul]: "/assets/profiles/kkul.png",
  [names.mineumon]: "/assets/profiles/mineumon.png",
  [names.kimsamdae]: "/assets/profiles/kimsamdae.png",
  [names.badeulbageulbadeul]: "/assets/profiles/badeulbageulbadeul.png",
  [names.ddiddu]: "/assets/profiles/ddiddu.png",
};

const defaultAccounts = [
  { id: "kkul", owner: names.kkul, queryName: names.kkul, label: names.kkul, avatarUrl: defaultAvatars[names.kkul] },
  { id: "mineumon", owner: names.mineumon, queryName: names.mineumon, label: names.mineumon, avatarUrl: defaultAvatars[names.mineumon] },
  { id: "kimsamdae", owner: names.kimsamdae, queryName: names.kimsamdae, label: names.kimsamdae, avatarUrl: defaultAvatars[names.kimsamdae] },
  { id: "badeulbageulbadeul", owner: names.badeulbageulbadeul, queryName: names.badeulbageulbadeul, label: names.badeulbageulbadeul, avatarUrl: defaultAvatars[names.badeulbageulbadeul] },
  { id: "ddiddu", owner: names.ddiddu, queryName: names.ddiddu, label: names.ddiddu, avatarUrl: defaultAvatars[names.ddiddu] },
];
const ownerOptions = defaultAccounts.map((account) => account.owner);
const raidCatalog = [
  { id: "serka-nm", name: "세르카 나메", minLevel: 1740, tier: "red" },
  { id: "serka-hard", name: "세르카 하드", minLevel: 1730, tier: "green" },
  { id: "serka-normal", name: "세르카 노말", minLevel: 1710, tier: "low" },
  { id: "jongha", name: "종하", minLevel: 1730, tier: "green" },
  { id: "jongno", name: "종노", minLevel: 1710, tier: "low" },
  { id: "cathedral-3", name: "성당3", minLevel: 1740, tier: "red" },
  { id: "cathedral-2", name: "성당2", minLevel: 1720, tier: "blue" },
  { id: "cathedral-1", name: "성당1", minLevel: 1700, tier: "base" },
  { id: "act4-hard", name: "4하", minLevel: 1720, tier: "blue" },
  { id: "act4-normal", name: "4노", minLevel: 1700, tier: "base" },
  { id: "act3-hard", name: "3하", minLevel: 1700, tier: "base" },
];
const raidRecommendations = [
  { minLevel: 1750, primary: ["세르카 나메", "종하", "성당3"], extra: ["4하"] },
  { minLevel: 1740, primary: ["세르카 나메", "종하", "4하"], extra: ["성당2"] },
  { minLevel: 1730, primary: ["세르카 하드", "종하", "4하"], extra: ["성당2"] },
  { minLevel: 1720, primary: ["4하", "성당2", "종노"], extra: ["세르카 노말"] },
  { minLevel: 1710, primary: ["세르카 노말", "종노", "4노"], extra: ["성당1"] },
  { minLevel: 1700, primary: ["4노", "성당1", "3하"], extra: [] },
];

const state = {
  accounts: loadAccounts(),
  rosters: [],
  assignments: loadAssignments(),
  raidPlans: loadRaidPlans(),
  isLoading: false,
  isRemoteReady: false,
  lastUpdatedAt: null,
};

const elements = {
  refreshButton: document.querySelector("#refresh-button"),
  saveRosterButton: document.querySelector("#save-roster-button"),
  editAccountsButton: document.querySelector("#edit-accounts-button"),
  openRosterButton: document.querySelector("#open-roster-button"),
  accountsDialog: document.querySelector("#accounts-dialog"),
  rosterDialog: document.querySelector("#roster-dialog"),
  accountEditor: document.querySelector("#account-editor"),
  addAccountButton: document.querySelector("#add-account-button"),
  saveAccountsButton: document.querySelector("#save-accounts-button"),
  status: document.querySelector("#status"),
  profileBoard: document.querySelector("#profile-board"),
  assignmentBoard: document.querySelector("#assignment-board"),
  rosterBoard: document.querySelector("#roster-board"),
  assignedRosterBoard: document.querySelector("#assigned-roster-board"),
  addRaidRowButton: document.querySelector("#add-raid-row-button"),
  saveRaidPlanButton: document.querySelector("#save-raid-plan-button"),
  raidPlanHead: document.querySelector("#raid-plan-head"),
  raidPlanBody: document.querySelector("#raid-plan-body"),
  raidPlanSummary: document.querySelector("#raid-plan-summary"),
  tabButtons: [...document.querySelectorAll("[data-tab-target]")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
  ownerCount: document.querySelector("#owner-count"),
  characterTotal: document.querySelector("#character-total"),
  assignedTotal: document.querySelector("#assigned-total"),
  ownerTemplate: document.querySelector("#owner-column-template"),
  sourceTemplate: document.querySelector("#source-column-template"),
  characterTemplate: document.querySelector("#character-card-template"),
};

elements.refreshButton.addEventListener("click", () => loadRosters({ refresh: true }));
elements.saveRosterButton.addEventListener("click", saveRosterChanges);
elements.editAccountsButton.addEventListener("click", openAccountEditor);
elements.openRosterButton.addEventListener("click", openRosterDialog);
elements.addAccountButton.addEventListener("click", addAccountEditorRow);
elements.saveAccountsButton.addEventListener("click", saveAccountEditor);
elements.addRaidRowButton.addEventListener("click", addRaidPlanRow);
elements.saveRaidPlanButton.addEventListener("click", saveRaidPlanChanges);
for (const button of elements.tabButtons) {
  button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
}

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

    return { account, ok: true, cached: payload.cached, characters };
  } catch (error) {
    return { account, ok: false, error: error.message, characters: [] };
  }
}

function renderAll() {
  renderSummary();
  renderProfileBoard();
  renderAssignmentBoard();
  renderRosterBoard();
  renderRaidPlanner();
}

function renderSummary() {
  elements.ownerCount.textContent = `${getOwners().length}명`;
  elements.characterTotal.textContent = getAllCharacters().length.toLocaleString("ko-KR");
  elements.assignedTotal.textContent = state.assignments.length.toLocaleString("ko-KR");
}

function renderProfileBoard() {
  const profiles = getOwners().map((owner) => {
    const card = document.createElement("article");
    card.className = "profile-card";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-image-button";
    button.setAttribute("aria-label", `${owner} 프로필 사진 변경`);

    const image = document.createElement("img");
    image.className = "profile-image";
    image.src = getOwnerAvatarUrl(owner);
    image.alt = "";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.className = "profile-file-input";
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", (event) => uploadOwnerProfileImage(owner, image, event.target.files?.[0]));

    button.append(image, input);
    button.addEventListener("click", () => input.click());

    const name = document.createElement("strong");
    name.textContent = owner;

    card.append(button, name);
    return card;
  });

  elements.profileBoard.replaceChildren(...profiles);
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

    setOwnerHeading(column.querySelector("h3"), owner);
    column.querySelector(".owner-count").textContent = `${assigned.length}`;

    if (!assigned.length) {
      const message = document.createElement("p");
      message.className = "column-message";
      message.textContent = "편성된 캐릭터 없음";
      list.replaceChildren(message);
      return column;
    }

    list.replaceChildren(...assigned.map((character) => createCharacterCard(character, "summary", owner)));
    return column;
  });

  elements.assignmentBoard.replaceChildren(...columns);
}

function renderRosterBoard(isLoading = false) {
  const accountGroups = getAccountGroups();
  const assignedKeys = new Set(state.assignments.map((assignment) => assignment.key));

  if (isLoading && !state.rosters.length) {
    elements.rosterBoard.replaceChildren(...accountGroups.map(createLoadingSourceColumn));
    elements.assignedRosterBoard.replaceChildren();
    return;
  }

  const columns = accountGroups.map((group) => {
    const rosters = group.accounts.map((account) => state.rosters.find((item) => item.account.id === account.id)).filter(Boolean);
    const fragment = elements.sourceTemplate.content.cloneNode(true);
    const column = fragment.querySelector(".source-column");
    const list = column.querySelector(".character-list");

    setOwnerHeading(column.querySelector("h3"), group.owner);
    column.querySelector(".source-meta").textContent = getAccountGroupMeta(group);

    if (state.isLoading && rosters.length < group.accounts.length) {
      column.querySelector(".source-count").textContent = "-";
      list.replaceChildren(...Array.from({ length: 5 }, createSkeletonRow));
      return column;
    }

    const failed = rosters.filter((roster) => !roster.ok);
    const characters = uniqueCharacters(rosters.flatMap((roster) => (roster.ok ? roster.characters : [])))
      .filter((character) => !assignedKeys.has(character.key))
      .sort(compareCharacters);

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
      message.className = failed.length ? "column-message is-error" : "column-message";
      message.textContent = failed.length ? listItems[0].textContent : `${minItemLevel}+ 캐릭터 없음`;
      list.replaceChildren(message);
      return column;
    }

    listItems.push(...characters.map((character) => createCharacterCard(character, "pool")));
    list.replaceChildren(...listItems);
    return column;
  });

  elements.rosterBoard.replaceChildren(...columns);
  renderAssignedRosterBoard();
}

function renderAssignedRosterBoard() {
  const charactersByKey = new Map(getAllCharacters().map((character) => [character.key, character]));
  const columns = getOwners().map((owner) => {
    const fragment = elements.sourceTemplate.content.cloneNode(true);
    const column = fragment.querySelector(".source-column");
    const list = column.querySelector(".character-list");
    const assigned = state.assignments
      .filter((assignment) => assignment.owner === owner)
      .map((assignment) => charactersByKey.get(assignment.key) ?? assignment.character)
      .filter(Boolean)
      .sort(compareCharacters);

    setOwnerHeading(column.querySelector("h3"), owner);
    column.querySelector(".source-meta").textContent = "편성됨";
    column.querySelector(".source-count").textContent = `${assigned.length}`;

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

  elements.assignedRosterBoard.replaceChildren(...columns);
}

function renderRaidPlanner() {
  const owners = getOwners();
  const rows = getRaidPlanRows();
  const headerRow = document.createElement("tr");
  headerRow.append(createTableHeader("제외"), createTableHeader("레이드명"), ...owners.map(createTableHeader), createTableHeader(""));
  elements.raidPlanHead.replaceChildren(headerRow);

  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = owners.length + 3;
    cell.className = "raid-empty-cell";
    cell.textContent = "레이드를 추가해서 편성표를 시작하세요.";
    row.append(cell);
    elements.raidPlanBody.replaceChildren(row);
    renderRaidPlanSummary();
    return;
  }

  elements.raidPlanBody.replaceChildren(...rows.map((plan) => createRaidPlanRow(plan, owners)));
  renderRaidPlanSummary();
}

function createTableHeader(label) {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = label;
  return cell;
}

function createRaidPlanRow(plan, owners) {
  const row = document.createElement("tr");
  row.dataset.raidPlanId = plan.id;

  const excludedCell = document.createElement("td");
  excludedCell.className = "raid-excluded-cell";
  const excluded = document.createElement("input");
  excluded.type = "checkbox";
  excluded.checked = Boolean(plan.excluded);
  excluded.setAttribute("aria-label", `${plan.raidName || "레이드"} 제외`);
  excluded.addEventListener("change", () => updateRaidPlan(plan.id, { excluded: excluded.checked }));
  excludedCell.append(excluded);

  const raidCell = document.createElement("td");
  raidCell.className = "raid-name-cell";
  const raidSelect = document.createElement("select");
  raidSelect.className = "raid-name-select";
  for (const raid of raidCatalog) {
    raidSelect.add(new Option(raid.name, raid.name, raid.name === plan.raidName, raid.name === plan.raidName));
  }
  raidSelect.add(new Option("직접 입력", "__custom__", !raidCatalog.some((raid) => raid.name === plan.raidName), !raidCatalog.some((raid) => raid.name === plan.raidName)));
  const customInput = document.createElement("input");
  customInput.className = "raid-name-input";
  customInput.type = "text";
  customInput.value = raidCatalog.some((raid) => raid.name === plan.raidName) ? "" : plan.raidName;
  customInput.placeholder = "레이드명";
  customInput.hidden = raidSelect.value !== "__custom__";
  raidSelect.addEventListener("change", () => {
    const isCustom = raidSelect.value === "__custom__";
    customInput.hidden = !isCustom;
    updateRaidPlan(plan.id, { raidName: isCustom ? customInput.value.trim() : raidSelect.value });
  });
  customInput.addEventListener("input", () => updateRaidPlan(plan.id, { raidName: customInput.value.trim() }, false));
  raidCell.append(raidSelect, customInput);

  const ownerCells = owners.map((owner) => createRaidOwnerCell(plan, owner));

  const actionsCell = document.createElement("td");
  actionsCell.className = "raid-row-actions";
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "icon-button";
  removeButton.setAttribute("aria-label", `${plan.raidName || "레이드"} 삭제`);
  removeButton.textContent = "×";
  removeButton.addEventListener("click", () => removeRaidPlanRow(plan.id));
  actionsCell.append(removeButton);

  row.append(excludedCell, raidCell, ...ownerCells, actionsCell);
  return row;
}

function createRaidOwnerCell(plan, owner) {
  const cell = document.createElement("td");
  const character = findCharacterByKey(plan.characters?.[owner]);
  if (character) {
    const status = getRaidPlanCellStatus(plan, character);
    cell.classList.toggle("is-extra-raid", status.isExtra);
    cell.classList.toggle("is-excluded-raid", status.isExcluded);
    cell.classList.toggle("is-duplicate-raid", status.isDuplicate);
  }
  const select = document.createElement("select");
  select.className = "raid-character-select";
  select.add(new Option("", ""));
  for (const character of getCharactersForOwner(owner)) {
    select.add(new Option(character.characterName, character.key, character.key === plan.characters?.[owner], character.key === plan.characters?.[owner]));
  }
  select.addEventListener("change", () => updateRaidPlanCharacter(plan.id, owner, select.value));
  cell.append(select);
  return cell;
}

function renderRaidPlanSummary() {
  const analysis = analyzeRaidPlans();
  const cards = [
    createRaidAnalysisCard("추가 레이드", analysis.missing, "추가로 고려할 골드 상위 레이드가 있습니다."),
    createRaidAnalysisCard("제외 레이드", analysis.excluded, "상위 추천 레이드가 아니거나 제외 체크된 항목입니다."),
    createRaidAnalysisCard("중복 편성", analysis.duplicates, "같은 캐릭터가 같은 레이드에 중복 편성되었습니다."),
  ];
  elements.raidPlanSummary.replaceChildren(...cards);
}

function createRaidAnalysisCard(title, items, emptyText) {
  const card = document.createElement("article");
  card.className = `raid-analysis-card${items.length ? " has-items" : ""}`;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const count = document.createElement("strong");
  count.textContent = `${items.length}`;
  const list = document.createElement("ul");
  const visibleItems = items.slice(0, 8);
  if (visibleItems.length) {
    for (const item of visibleItems) {
      const row = document.createElement("li");
      row.textContent = item;
      list.append(row);
    }
    if (items.length > visibleItems.length) {
      const row = document.createElement("li");
      row.textContent = `외 ${items.length - visibleItems.length}건`;
      list.append(row);
    }
  } else {
    const row = document.createElement("li");
    row.textContent = emptyText;
    list.append(row);
  }
  card.append(heading, count, list);
  return card;
}

function analyzeRaidPlans() {
  const selectedByCharacter = new Map();
  const excluded = [];
  const duplicates = [];

  for (const plan of getRaidPlanRows()) {
    const raidName = plan.raidName?.trim();
    if (!raidName) continue;

    for (const [owner, key] of Object.entries(plan.characters ?? {})) {
      if (!key) continue;
      const character = findCharacterByKey(key);
      if (!character) continue;
      const label = `${owner} · ${character.characterName} · ${raidName}`;

      if (plan.excluded) excluded.push(label);
      if (!selectedByCharacter.has(key)) selectedByCharacter.set(key, []);
      selectedByCharacter.get(key).push({ raidName, owner, character, excluded: Boolean(plan.excluded) });
    }
  }

  const missing = [];
  for (const character of getAssignedCharacters()) {
    const selected = selectedByCharacter.get(character.key) ?? [];
    const activeRaidNames = selected.filter((item) => !item.excluded).map((item) => item.raidName);
    const recommended = getRecommendedRaids(character);
    const extra = getExtraRaids(character);

    for (const raidName of extra) {
      if (!activeRaidNames.includes(raidName)) missing.push(`${character.defaultOwner ?? ""} · ${character.characterName} · ${raidName}`.trim());
    }

    for (const item of selected.filter((entry) => !entry.excluded)) {
      if (!recommended.includes(item.raidName) && !extra.includes(item.raidName)) excluded.push(`${item.owner} · ${character.characterName} · ${item.raidName}`);
    }

    const counts = new Map();
    for (const item of selected.filter((entry) => !entry.excluded)) {
      counts.set(item.raidName, (counts.get(item.raidName) ?? 0) + 1);
    }
    for (const [raidName, count] of counts.entries()) {
      if (count > 1) duplicates.push(`${character.characterName} · ${raidName} ${count}회`);
    }
  }

  return { missing, excluded: uniqueStrings(excluded), duplicates: uniqueStrings(duplicates) };
}

function addRaidPlanRow() {
  const owners = getOwners();
  const raidName = raidCatalog[0]?.name ?? "";
  state.raidPlans.push({
    id: createId("raid"),
    raidName,
    excluded: false,
    characters: Object.fromEntries(owners.map((owner) => [owner, ""])),
  });
  saveRaidPlans();
  renderRaidPlanner();
}

async function saveRaidPlanChanges() {
  saveRaidPlans();
  elements.saveRaidPlanButton.disabled = true;
  const ok = await saveSheetState();
  elements.saveRaidPlanButton.disabled = false;
  setStatus(ok ? "레이드 편성 저장 완료" : "레이드 편성 저장 실패", ok ? "success" : "error");
}

function removeRaidPlanRow(id) {
  state.raidPlans = state.raidPlans.filter((plan) => plan.id !== id);
  saveRaidPlans();
  renderRaidPlanner();
}

function updateRaidPlan(id, patch, shouldRender = true) {
  state.raidPlans = getRaidPlanRows().map((plan) => (plan.id === id ? { ...plan, ...patch } : plan));
  saveRaidPlans();
  if (shouldRender) renderRaidPlanner();
  else renderRaidPlanSummary();
}

function updateRaidPlanCharacter(id, owner, key) {
  state.raidPlans = getRaidPlanRows().map((plan) => {
    if (plan.id !== id) return plan;
    return { ...plan, characters: { ...(plan.characters ?? {}), [owner]: key } };
  });
  saveRaidPlans();
  renderRaidPlanner();
}

function createLoadingSourceColumn(group) {
  const fragment = elements.sourceTemplate.content.cloneNode(true);
  const column = fragment.querySelector(".source-column");
  setOwnerHeading(column.querySelector("h3"), group.owner);
  column.querySelector(".source-meta").textContent = getAccountGroupMeta(group);
  column.querySelector(".source-count").textContent = "-";
  column.querySelector(".character-list").replaceChildren(...Array.from({ length: 5 }, createSkeletonRow));
  return column;
}

function createCharacterCard(character, mode) {
  const fragment = elements.characterTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".character-card");
  const actions = card.querySelector(".character-actions");
  const isAssigned = state.assignments.some((assignment) => assignment.key === character.key);

  card.classList.toggle("is-summary", mode === "summary");
  card.classList.toggle("is-assigned", mode === "assigned");
  card.dataset.tier = getLevelTier(character.itemLevelNumber);
  card.querySelector(".character-name").textContent = character.characterName;
  card.querySelector(".class-name").textContent = character.characterClassName;
  card.querySelector(".item-level").textContent = character.itemAvgLevel;

  if (mode === "summary") {
    actions.remove();
    return card;
  }

  if (mode === "assigned") {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-character-button";
    removeButton.setAttribute("aria-label", `${character.characterName} 편성 해제`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => removeAssignment(character.key));
    actions.replaceChildren(removeButton);
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
  for (const owner of getOwners()) select.add(new Option(owner, owner, owner === selectedOwner, owner === selectedOwner));
  return select;
}

function addAssignment(character, owner) {
  if (state.assignments.some((assignment) => assignment.key === character.key)) return;
  state.assignments.push({ key: character.key, owner, character });
  saveAssignments();
  renderAll();
}

function removeAssignment(key) {
  state.assignments = state.assignments.filter((assignment) => assignment.key !== key);
  saveAssignments();
  renderAll();
}

function pruneAssignments() {
  const knownKeys = new Set(getAllCharacters().map((character) => character.key));
  const previousLength = state.assignments.length;
  state.assignments = state.assignments.filter((assignment) => knownKeys.has(assignment.key));
  if (state.assignments.length !== previousLength) saveAssignments();
}

async function saveRosterChanges() {
  elements.saveRosterButton.disabled = true;
  setStatus("편성 저장 중", "loading");
  const ok = await saveSheetState();
  elements.saveRosterButton.disabled = false;
  setStatus(ok ? `${minItemLevel}+ ${getAllCharacters().length}명 조회 · 편성 저장 완료` : "편성 저장 실패", ok ? "success" : "error");
}

function openAccountEditor() {
  elements.accountEditor.replaceChildren();
  for (const account of state.accounts) addAccountEditorRow(account);
  elements.accountsDialog.showModal();
}

function openRosterDialog() {
  elements.rosterDialog.showModal();
}

function activateTab(panelId) {
  for (const button of elements.tabButtons) {
    const isActive = button.dataset.tabTarget === panelId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  }

  for (const panel of elements.tabPanels) {
    const isActive = panel.id === panelId;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  }
}

function addAccountEditorRow(account = {}) {
  const row = document.createElement("div");
  row.className = "account-row";
  row.innerHTML = `
    <label>캐릭터명<input data-field="queryName" type="text" value="${escapeAttribute(account.queryName ?? account.label ?? "")}" placeholder="대표 캐릭터명" /></label>
    <label>소속<select data-field="owner">${createOwnerOptions(account.owner)}</select></label>
    <button class="small-button danger" type="button">삭제</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  elements.accountEditor.append(row);
}

function saveAccountEditor() {
  const rows = [...elements.accountEditor.querySelectorAll(".account-row")];
  const nextAccounts = rows.map((row, index) => {
    const queryName = row.querySelector('[data-field="queryName"]').value.trim();
    const owner = row.querySelector('[data-field="owner"]').value.trim();
    const previous = state.accounts.find((account) => account.owner === owner || account.queryName === queryName);
    const avatarUrl = previous?.avatarUrl || defaultAvatars[owner] || "";
    if (!queryName || !owner) return null;
    return { id: stableAccountId(queryName, queryName, index), label: queryName, queryName, owner, avatarUrl };
  }).filter(Boolean);

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

function getAssignedCharacters() {
  const charactersByKey = new Map(getAllCharacters().map((character) => [character.key, character]));
  return state.assignments
    .map((assignment) => charactersByKey.get(assignment.key) ?? assignment.character)
    .filter(Boolean);
}

function getCharactersForOwner(owner) {
  const charactersByKey = new Map(getAllCharacters().map((character) => [character.key, character]));
  return state.assignments
    .filter((assignment) => assignment.owner === owner)
    .map((assignment) => charactersByKey.get(assignment.key) ?? assignment.character)
    .filter(Boolean)
    .sort(compareCharacters);
}

function findCharacterByKey(key) {
  return getAssignedCharacters().find((character) => character.key === key);
}

function getRecommendedRaids(character) {
  return getRaidRecommendation(character).primary;
}

function getExtraRaids(character) {
  return getRaidRecommendation(character).extra;
}

function getRaidRecommendation(character) {
  return raidRecommendations.find((item) => character.itemLevelNumber >= item.minLevel) ?? { primary: [], extra: [] };
}

function getRaidPlanCellStatus(plan, character) {
  const raidName = plan.raidName?.trim();
  const recommended = getRecommendedRaids(character);
  const extra = getExtraRaids(character);
  const sameRaidCount = getRaidPlanRows().filter((row) => {
    if (row.excluded || row.raidName !== raidName) return false;
    return Object.values(row.characters ?? {}).includes(character.key);
  }).length;
  return {
    isExtra: extra.includes(raidName),
    isExcluded: Boolean(plan.excluded) || (!!raidName && !recommended.includes(raidName) && !extra.includes(raidName)),
    isDuplicate: sameRaidCount > 1,
  };
}

function getRaidPlanRows() {
  const owners = getOwners();
  return normalizeRaidPlans(state.raidPlans).map((plan) => ({
    ...plan,
    characters: Object.fromEntries(owners.map((owner) => [owner, plan.characters?.[owner] ?? ""])),
  }));
}

function getOwners() {
  return [...new Set(state.accounts.map((account) => account.owner).filter(Boolean))];
}

function getAccountGroups() {
  const groups = new Map();
  for (const account of state.accounts) {
    const owner = account.owner || account.label || account.queryName;
    if (!owner) continue;
    if (!groups.has(owner)) groups.set(owner, { owner, accounts: [] });
    groups.get(owner).accounts.push(account);
  }
  return Array.from(groups.values());
}

function getAccountGroupMeta(group) {
  const queryNames = [...new Set(group.accounts.map((account) => account.queryName).filter(Boolean))];
  return `조회: ${queryNames.join(", ")}`;
}

function setOwnerHeading(heading, owner) {
  heading.textContent = "";
  const image = document.createElement("img");
  image.className = "owner-avatar";
  image.src = getOwnerAvatarUrl(owner);
  image.alt = "";
  const name = document.createElement("span");
  name.textContent = owner;
  heading.append(image, name);
}

function getOwnerAvatarUrl(owner) {
  return state.accounts.find((account) => account.owner === owner && account.avatarUrl)?.avatarUrl ?? defaultAvatars[owner] ?? "";
}

async function uploadOwnerProfileImage(owner, preview, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("이미지 파일만 업로드할 수 있습니다.", "error");
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    setStatus("프로필 사진은 4MB 이하만 업로드할 수 있습니다.", "error");
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  preview.src = dataUrl;
  setOwnerAvatarUrl(owner, dataUrl);
  saveAccounts();
  await saveSheetState();
  renderAll();
  setStatus("프로필 사진이 삽입됐습니다. Blob에 업로드 중...", "loading");

  try {
    const response = await fetch("/api/profile-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, dataUrl }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "프로필 사진 업로드에 실패했습니다.");

    setOwnerAvatarUrl(owner, payload.url);
    saveAccounts();
    await saveSheetState();
    renderAll();
    setStatus("프로필 사진 업로드 완료", "success");
  } catch (error) {
    setStatus(`${error.message} 현재 선택한 이미지는 화면에 임시로 삽입됐습니다.`, "error");
  }
}

function setOwnerAvatarUrl(owner, avatarUrl) {
  state.accounts = state.accounts.map((account) => (account.owner === owner ? { ...account, avatarUrl } : account));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error("이미지를 읽을 수 없습니다.")));
    reader.readAsDataURL(file);
  });
}

function uniqueCharacters(characters) {
  const charactersByKey = new Map();
  for (const character of characters) {
    const key = character.key ?? characterKey(character);
    if (!charactersByKey.has(key)) charactersByKey.set(key, character);
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
  if (level >= 1710) return "low";
  return "base";
}

function createSkeletonRow() {
  const row = document.createElement("div");
  row.className = "character-card is-skeleton";
  row.innerHTML = "<span></span><span></span>";
  return row;
}

function loadAccounts() {
  const savedAccounts = normalizeAccounts(readJson(storageKeys.accounts, null));
  if (savedAccounts.length) return mergeDefaultAvatars(savedAccounts);
  const legacyAccounts = normalizeAccounts(readJson(storageKeys.legacyAccounts, null));
  if (legacyAccounts.length) return mergeDefaultAvatars(legacyAccounts);
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

function loadRaidPlans() {
  return normalizeRaidPlans(readJson(storageKeys.raidPlans, []));
}

function saveRaidPlans() {
  localStorage.setItem(storageKeys.raidPlans, JSON.stringify(state.raidPlans));
}

async function loadSheetState() {
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("remote state unavailable");
    const payload = await response.json();
    const remoteAccounts = normalizeAccounts(payload.accounts);
    const remoteAssignments = normalizeAssignments(payload.assignments);
    const remoteRaidPlans = normalizeRaidPlans(payload.raidPlans);
    const nextAccounts = remoteAccounts.length ? mergeAccountLists(remoteAccounts, state.accounts) : state.accounts;
    state.accounts = mergeDefaultAvatars(nextAccounts);
    if (Array.isArray(payload.assignments)) state.assignments = remoteAssignments;
    if (Array.isArray(payload.raidPlans)) state.raidPlans = remoteRaidPlans;
    state.isRemoteReady = true;
    saveAccounts();
    saveAssignments();
    saveRaidPlans();
    renderAll();
    if (!payload.exists || nextAccounts.length !== remoteAccounts.length) saveSheetState();
  } catch {
    state.isRemoteReady = false;
  }
}

async function saveSheetState() {
  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accounts: state.accounts, assignments: state.assignments, raidPlans: state.raidPlans }),
    });
    state.isRemoteReady = response.ok;
    return response.ok;
  } catch {
    state.isRemoteReady = false;
    return false;
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
  return accounts.map((account, index) => {
    const label = String(account?.label ?? "").trim();
    const queryName = String(account?.queryName ?? "").trim();
    const owner = String(account?.owner ?? "").trim();
    if (!queryName || !owner) return null;
    return {
      id: String(account?.id ?? `account-${index}`).trim() || `account-${index}`,
      label: label || queryName,
      queryName,
      owner,
      avatarUrl: String(account?.avatarUrl ?? defaultAvatars[owner] ?? "").trim(),
    };
  }).filter(Boolean);
}

function createOwnerOptions(selectedOwner = "") {
  return ownerOptions.map((owner) => `<option value="${escapeAttribute(owner)}"${owner === selectedOwner ? " selected" : ""}>${owner}</option>`).join("");
}

function normalizeAssignments(assignments) {
  if (!Array.isArray(assignments)) return [];
  return assignments.map((assignment) => {
    const key = String(assignment?.key ?? "").trim();
    const owner = String(assignment?.owner ?? "").trim();
    if (!key || !owner || !assignment?.character) return null;
    return { key, owner, character: assignment.character };
  }).filter(Boolean);
}

function normalizeRaidPlans(raidPlans) {
  if (!Array.isArray(raidPlans)) return [];
  return raidPlans.map((plan, index) => {
    const id = String(plan?.id ?? `raid-${index}`).trim() || `raid-${index}`;
    const raidName = String(plan?.raidName ?? "").trim();
    const characters = plan?.characters && typeof plan.characters === "object" ? plan.characters : {};
    return {
      id,
      raidName,
      excluded: Boolean(plan?.excluded),
      characters: Object.fromEntries(Object.entries(characters).map(([owner, key]) => [String(owner), String(key ?? "")])),
    };
  }).filter((plan) => plan.raidName || Object.values(plan.characters).some(Boolean));
}

function mergeDefaultAvatars(accounts) {
  return mergeAccountLists(accounts, defaultAccounts).map((account) => ({
    ...account,
    avatarUrl: account.avatarUrl || defaultAvatars[account.owner] || "",
  }));
}

function mergeAccountLists(primaryAccounts, fallbackAccounts = []) {
  const accountsByIdentity = new Map();

  for (const account of [...fallbackAccounts, ...primaryAccounts]) {
    const key = `${account.owner}:${account.queryName}`;
    accountsByIdentity.set(key, account);
  }

  return Array.from(accountsByIdentity.values());
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

function uniqueStrings(items) {
  return [...new Set(items.filter(Boolean))];
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
