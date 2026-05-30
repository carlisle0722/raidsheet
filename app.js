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
  { id: "jongha", name: "종막 하드", minLevel: 1730, tier: "green" },
  { id: "jongno", name: "종막 노말", minLevel: 1710, tier: "low" },
  { id: "cathedral-3", name: "성당 3단계", minLevel: 1740, tier: "red" },
  { id: "cathedral-2", name: "성당 2단계", minLevel: 1720, tier: "blue" },
  { id: "cathedral-1", name: "성당 1단계", minLevel: 1700, tier: "base" },
  { id: "act4-hard", name: "4막 하드", minLevel: 1720, tier: "blue" },
  { id: "act4-normal", name: "4막 노말", minLevel: 1700, tier: "base" },
  { id: "act3-hard", name: "3막 하드", minLevel: 1700, tier: "base" },
];
const raidRecommendations = [
  { minLevel: 1750, primary: ["세르카 나메", "종막 하드", "성당 3단계"], extra: ["4막 하드"] },
  { minLevel: 1740, primary: ["세르카 나메", "종막 하드", "4막 하드"], extra: ["성당 2단계"] },
  { minLevel: 1730, primary: ["세르카 하드", "종막 하드", "4막 하드"], extra: ["성당 2단계"] },
  { minLevel: 1720, primary: ["4막 하드", "성당 2단계", "종막 노말"], extra: ["세르카 노말"] },
  { minLevel: 1710, primary: ["세르카 노말", "종막 노말", "4막 노말"], extra: ["성당 1단계"] },
  { minLevel: 1700, primary: ["4막 노말", "성당 1단계", "3막 하드"], extra: [] },
];
const raidFilterOrder = [
  "성당 3단계",
  "세르카 나메",
  "세르카 하드",
  "종막 하드",
  "4막 하드",
  "성당 2단계",
  "종막 노말",
  "세르카 노말",
  "3막 하드",
];

const state = {
  accounts: loadAccounts(),
  rosters: [],
  assignments: loadAssignments(),
  raidPlans: loadRaidPlans(),
  raidPlanDrafts: [],
  selectedRaidPlanIds: new Set(),
  editingRaidPlanIds: new Set(),
  raidPlanEditBackup: null,
  draggingRaidPlanId: null,
  raidPlanFilter: null,
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
  savingOverlay: document.querySelector("#saving-overlay"),
  profileBoard: document.querySelector("#profile-board"),
  assignmentBoard: document.querySelector("#assignment-board"),
  rosterBoard: document.querySelector("#roster-board"),
  assignedRosterBoard: document.querySelector("#assigned-roster-board"),
  addRaidRowButton: document.querySelector("#add-raid-row-button"),
  saveRaidPlanButton: document.querySelector("#save-raid-plan-button"),
  saveRaidPlanBottomButton: document.querySelector("#save-raid-plan-bottom-button"),
  editRaidRowButton: document.querySelector("#edit-raid-row-button"),
  deleteRaidRowButton: document.querySelector("#delete-raid-row-button"),
  cancelRaidEditButton: document.querySelector("#cancel-raid-edit-button"),
  cancelRaidDraftButton: document.querySelector("#cancel-raid-draft-button"),
  resetRaidCompleteButton: document.querySelector("#reset-raid-complete-button"),
  raidSavedBoard: document.querySelector("#raid-saved-board"),
  raidPlanHead: document.querySelector("#raid-plan-head"),
  raidPlanBody: document.querySelector("#raid-plan-body"),
  raidPlanSummary: document.querySelector("#raid-plan-summary"),
  missingRaidBoard: document.querySelector("#missing-raid-board"),
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
elements.saveRaidPlanBottomButton.addEventListener("click", saveRaidPlanChanges);
elements.editRaidRowButton.addEventListener("click", editSelectedRaidPlan);
elements.deleteRaidRowButton.addEventListener("click", deleteSelectedRaidPlan);
elements.cancelRaidEditButton.addEventListener("click", cancelRaidEdits);
elements.cancelRaidDraftButton.addEventListener("click", cancelRaidDrafts);
elements.resetRaidCompleteButton.addEventListener("click", resetRaidCompleted);
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
  renderMissingRaidBoard();
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

function renderMissingRaidBoard() {
  if (!elements.missingRaidBoard) return;
  const owners = getOwners();
  elements.missingRaidBoard.replaceChildren(...owners.map((owner) => createMissingOwnerCard(owner)));
}

function createMissingOwnerCard(owner) {
  const card = document.createElement("article");
  card.className = "missing-owner-card";

  const heading = document.createElement("div");
  heading.className = "missing-owner-heading";
  const image = document.createElement("img");
  image.className = "owner-avatar";
  image.src = getOwnerAvatarUrl(owner);
  image.alt = "";
  const title = document.createElement("h3");
  title.textContent = owner;
  heading.append(image, title);

  const characters = getCharactersForOwner(owner);
  const rows = characters.map((character) => ({ character, missing: getMissingRaidsForCharacter(character) })).filter((row) => row.missing.primary.length || row.missing.extra.length);

  const body = document.createElement("div");
  body.className = "missing-owner-body";

  if (!characters.length) {
    const message = document.createElement("p");
    message.className = "missing-empty";
    message.textContent = "편성된 캐릭터가 없습니다.";
    body.append(message);
  } else if (!rows.length) {
    const message = document.createElement("p");
    message.className = "missing-empty is-complete";
    message.textContent = "필수/추가 레이드가 모두 편성됐습니다.";
    body.append(message);
  } else {
    body.append(...rows.map(createMissingCharacterRow));
  }

  card.append(heading, body);
  return card;
}

function createMissingCharacterRow(data) {
  const { character, missing } = data;
  const row = document.createElement("div");
  row.className = "missing-character-row";
  row.dataset.tier = getLevelTier(character.itemLevelNumber);

  const main = document.createElement("div");
  main.className = "missing-character-main";
  const name = document.createElement("strong");
  name.textContent = character.characterName;
  const meta = document.createElement("span");
  meta.textContent = character.characterClassName + " · " + character.itemAvgLevel;
  main.append(name, meta);

  row.append(main, createMissingRaidGroup("필수 레이드", missing.primary, "primary"), createMissingRaidGroup("추가 레이드", missing.extra, "extra"));
  return row;
}

function createMissingRaidGroup(label, raids, tone) {
  const group = document.createElement("div");
  group.className = "missing-raid-group is-" + tone;
  const title = document.createElement("span");
  title.className = "missing-raid-label";
  title.textContent = label;
  const list = document.createElement("div");
  list.className = "missing-raid-list";

  if (!raids.length) {
    const empty = document.createElement("em");
    empty.textContent = "없음";
    list.append(empty);
  } else {
    list.append(...raids.map((raidName) => {
      const chip = document.createElement("span");
      chip.className = "missing-raid-chip";
      chip.textContent = raidName;
      chip.dataset.tier = getRaidTier(raidName);
      return chip;
    }));
  }

  group.append(title, list);
  return group;
}

function getMissingRaidsForCharacter(character) {
  const planned = getPlannedRaidsForCharacter(character.key);
  return {
    primary: getRecommendedRaids(character).filter((raidName) => !planned.has(raidName)),
    extra: getExtraRaids(character).filter((raidName) => !planned.has(raidName)),
  };
}

function getPlannedRaidsForCharacter(characterKey) {
  const planned = new Set();
  for (const plan of getRaidPlanRows(state.raidPlans)) {
    if (plan.excluded || !plan.raidName) continue;
    if (Object.values(plan.characters ?? {}).includes(characterKey)) planned.add(plan.raidName);
  }
  return planned;
}
function renderRaidPlanner() {
  const owners = getOwners();
  renderSavedRaidPlanner(owners);
  renderRaidEditor(owners);
  renderRaidPlanActions();
}

function renderSavedRaidPlanner(owners) {
  const rows = getFilteredRaidPlanRows(getRaidPlanRows(state.raidPlans));

  if (!rows.length) {
    const message = document.createElement("p");
    message.className = "column-message raid-saved-empty";
    message.textContent =
      "아래에서 레이드를 추가하고 저장하면 편성표가 표시됩니다.";
    elements.raidSavedBoard.replaceChildren(message);
    return;
  }

  const table = document.createElement("table");
  table.className = "raid-saved-table";
  const colgroup = document.createElement("colgroup");
  const orderCol = document.createElement("col");
  orderCol.className = "raid-order-col";
  const completedCol = document.createElement("col");
  completedCol.className = "raid-complete-col";
  const raidCol = document.createElement("col");
  raidCol.className = "raid-name-col";
  const ownerCols = owners.map(() => {
    const col = document.createElement("col");
    col.className = "raid-owner-col";
    return col;
  });
  colgroup.append(orderCol, completedCol, raidCol, ...ownerCols);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  headRow.append(createTableHeader("순서"), createTableHeader("완료"), createRaidHeaderCell());

  owners.forEach((owner) => {
    headRow.append(createOwnerRaidHeaderCell(owner));
  });

  thead.append(headRow);

  const tbody = document.createElement("tbody");

  rows.forEach((plan) => {
    tbody.append(createSavedRaidPlanRow(plan, owners));
  });

  table.append(colgroup, thead, tbody);

  elements.raidSavedBoard.replaceChildren(table);
}

function renderRaidEditor(owners) {
  const rows = getRaidPlanRows(state.raidPlanDrafts);
  const headerRow = document.createElement("tr");
  headerRow.append(createTableHeader("레이드명"), ...owners.map(createTableHeader), createTableHeader(""));
  elements.raidPlanHead.replaceChildren(headerRow);

  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = owners.length + 2;
    cell.className = "raid-empty-cell";
    cell.textContent = "레이드 추가를 누르면 여기에서 편성할 수 있습니다.";
    row.append(cell);
    elements.raidPlanBody.replaceChildren(row);
    renderRaidPlanSummary();
    return;
  }

  elements.raidPlanBody.replaceChildren(...rows.map((plan) => createRaidPlanRow(plan, owners)));
  renderRaidPlanSummary();
}

function renderRaidPlanActions() {
  pruneRaidPlanSelection();
  const selectedCount = state.selectedRaidPlanIds.size;
  const editingCount = state.editingRaidPlanIds.size;
  const hasSelected = selectedCount > 0;
  elements.editRaidRowButton.disabled = !hasSelected;
  elements.deleteRaidRowButton.disabled = !hasSelected;
  elements.editRaidRowButton.textContent = editingCount ? `수정 중 (${editingCount})` : selectedCount > 1 ? `수정 (${selectedCount})` : "수정";
  elements.deleteRaidRowButton.textContent = selectedCount > 1 ? `삭제 (${selectedCount})` : "삭제";
}

function createTableHeader(label) {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = label;
  return cell;
}

function createRaidHeaderCell() {
  const cell = createTableHeader("");
  cell.append(createFilterHeaderContent("레이드", "raid", getRaidFilterOptions(), state.raidPlanFilter?.type === "raid" ? state.raidPlanFilter.value : ""));
  return cell;
}

function createOwnerRaidHeaderCell(owner) {
  const cell = createTableHeader("");
  cell.append(createFilterHeaderContent(owner, "character", getCharacterFilterOptions(owner), state.raidPlanFilter?.type === "character" && state.raidPlanFilter.owner === owner ? state.raidPlanFilter.value : "", owner));
  return cell;
}

function createFilterHeaderContent(label, type, options, selectedValue, owner = "") {
  const wrap = document.createElement("div");
  wrap.className = type === "character" ? "raid-filter-heading owner-filter-heading" : "raid-filter-heading";

  if (type === "character") {
    const image = document.createElement("img");
    image.className = "owner-avatar";
    image.src = getOwnerAvatarUrl(label);
    image.alt = "";
    wrap.append(image);
  }

  const text = document.createElement("span");
  text.textContent = label;
  wrap.append(text);

  const select = document.createElement("select");
  select.className = "raid-filter-select";
  select.setAttribute("aria-label", `${label} 필터`);
  select.add(new Option("전체", ""));
  options.forEach((option) => select.add(new Option(option.label, option.value, option.value === selectedValue, option.value === selectedValue)));
  select.value = selectedValue;
  select.addEventListener("click", (event) => event.stopPropagation());
  select.addEventListener("change", () => {
    state.raidPlanFilter = select.value ? { type, owner, value: select.value } : null;
    state.selectedRaidPlanIds.clear();
    state.editingRaidPlanIds.clear();
    renderRaidPlanner();
    renderMissingRaidBoard();
  });

  const control = document.createElement("label");
  control.className = "raid-filter-control";
  const icon = document.createElement("span");
  icon.className = "raid-filter-icon";
  icon.setAttribute("aria-hidden", "true");
  control.append(icon, select);
  wrap.append(control);
  return wrap;
}

function createRaidPlanRow(plan, owners) {
  const row = document.createElement("tr");
  row.dataset.raidPlanId = plan.id;
  row.dataset.raidTier = getRaidTier(plan.raidName);
  row.dataset.raidColor = getRaidColorIndex(plan.raidName);

  const raidCell = document.createElement("td");
  raidCell.className = "raid-name-cell";
  raidCell.append(...createRaidNameSelect(plan, (raidName, shouldRender) => updateRaidPlan(plan.id, { raidName }, shouldRender)));
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

  row.append(raidCell, ...ownerCells, actionsCell);
  return row;
}

function createRaidNameSelect(plan, onChange) {
  const raidSelect = document.createElement("select");
  raidSelect.className = "raid-name-select";
  const isCatalogRaid = raidCatalog.some((raid) => raid.name === plan.raidName);
  for (const raid of raidCatalog) {
    raidSelect.add(new Option(raid.name, raid.name, raid.name === plan.raidName, raid.name === plan.raidName));
  }
  if (!isCatalogRaid && plan.raidName) {
    raidSelect.add(new Option(plan.raidName, plan.raidName, true, true));
  }
  raidSelect.addEventListener("change", () => {
    onChange(raidSelect.value, true);
  });
  return [raidSelect];
}

function createSavedRaidPlanRow(plan, owners) {
  const row = document.createElement("tr");
  row.dataset.raidPlanId = plan.id;
  row.dataset.raidTier = getRaidTier(plan.raidName);
  row.dataset.raidColor = getRaidColorIndex(plan.raidName);
  row.classList.toggle("is-selected", state.selectedRaidPlanIds.has(plan.id));
  row.classList.toggle("is-completed", Boolean(plan.completed));
  row.classList.toggle("is-editing", state.editingRaidPlanIds.has(plan.id));
  row.addEventListener("click", (event) => {
    if (event.target.closest("button, input, select, label, .raid-order-cell, .raid-completed-cell")) return;
    selectRaidPlanRow(plan.id);
  });
  row.addEventListener("dragover", (event) => {
    if (!state.draggingRaidPlanId || state.draggingRaidPlanId === plan.id) return;
    event.preventDefault();
    row.classList.add("is-drag-over");
  });
  row.addEventListener("dragleave", () => row.classList.remove("is-drag-over"));
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("is-drag-over");
    reorderSavedRaidPlan(state.draggingRaidPlanId, plan.id);
  });

  const orderCell = document.createElement("td");
  orderCell.className = "raid-order-cell";
  orderCell.addEventListener("click", (event) => event.stopPropagation());
  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "raid-drag-handle";
  dragHandle.draggable = true;
  dragHandle.setAttribute("aria-label", `${plan.raidName || "레이드"} 순서 변경`);
  dragHandle.textContent = "☰";
  dragHandle.addEventListener("click", (event) => event.stopPropagation());
  dragHandle.addEventListener("dragstart", (event) => {
    state.draggingRaidPlanId = plan.id;
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", plan.id);
  });
  dragHandle.addEventListener("dragend", () => {
    state.draggingRaidPlanId = null;
    renderRaidPlanner();
    renderMissingRaidBoard();
  });
  orderCell.append(dragHandle);

  const completedCell = document.createElement("td");
  completedCell.className = "raid-completed-cell";
  const completed = document.createElement("input");
  completed.type = "checkbox";
  completed.checked = Boolean(plan.completed);
  completed.setAttribute("aria-label", `${plan.raidName || "레이드"} 완료`);
  completed.addEventListener("click", (event) => event.stopPropagation());
  completed.addEventListener("change", () => updateSavedRaidPlan(plan.id, { completed: completed.checked }));
  completedCell.append(completed);
  completedCell.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === completed) return;
    completed.checked = !completed.checked;
    updateSavedRaidPlan(plan.id, { completed: completed.checked });
  });

  const raidCell = document.createElement("td");
  raidCell.className = "raid-name-cell";
  if (state.editingRaidPlanIds.has(plan.id)) {
    raidCell.append(...createRaidNameSelect(plan, (raidName) => updateSavedRaidPlanLocal(plan.id, { raidName })));
  } else {
    const raidName = document.createElement("strong");
    raidName.className = "raid-name-readonly";
    raidName.textContent = plan.raidName || "-";
    raidCell.append(raidName);
  }

  row.append(orderCell, completedCell, raidCell, ...owners.map((owner) => {
    if (state.editingRaidPlanIds.has(plan.id)) return createRaidOwnerCell(plan, owner, "saved");
    return createSavedRaidOwnerTableCell(plan, owner);
  }));
  return row;
}

function createSavedRaidOwnerTableCell(plan, owner) {
  const cell = document.createElement("td");
  cell.className = "raid-character-cell";
  const character = findCharacterByKey(plan.characters?.[owner]);
  if (!character) {
    const empty = document.createElement("span");
    empty.className = "raid-member-empty";
    empty.textContent = "-";
    cell.append(empty);
    return cell;
  }

  const status = getRaidPlanCellStatus(plan, character, state.raidPlans);
  cell.dataset.tier = getLevelTier(character.itemLevelNumber);
    cell.classList.toggle("is-extra-raid", status.isExtra);
    cell.classList.toggle("is-excluded-raid", status.isExcluded);
    cell.classList.toggle("is-duplicate-raid", status.isDuplicate);
  cell.title = `${character.characterName} · ${character.itemAvgLevel}`;

  const name = document.createElement("span");
  name.className = "raid-character-chip";
  name.textContent = `${character.characterName}`;
  cell.append(name);
  return cell;
}

function createRaidOwnerCell(plan, owner, scope = "draft") {
  const cell = document.createElement("td");
  if (scope === "saved") cell.className = "raid-character-cell";
  const character = findCharacterByKey(plan.characters?.[owner]);
  if (character) {
    const status = getRaidPlanCellStatus(plan, character, scope === "saved" ? state.raidPlans : state.raidPlanDrafts);
    cell.dataset.tier = getLevelTier(character.itemLevelNumber);
  cell.classList.toggle("is-extra-raid", status.isExtra);
  cell.classList.toggle("is-excluded-raid", status.isExcluded);
  cell.classList.toggle("is-duplicate-raid", status.isDuplicate);
    cell.classList.toggle("has-duplicate-option", getRaidCharacterOptionStatus(plan, character, scope === "saved" ? state.raidPlans : [...state.raidPlans, ...state.raidPlanDrafts]).isDuplicate);
  }
  const select = document.createElement("select");
  select.className = "raid-character-select";
  select.add(new Option("", ""));
  const raidPlans = scope === "saved" ? state.raidPlans : [...state.raidPlans, ...state.raidPlanDrafts];
  for (const character of getCharactersForOwner(owner).filter((item) => canJoinRaid(item, plan.raidName))) {
    const option = new Option(character.characterName, character.key, character.key === plan.characters?.[owner], character.key === plan.characters?.[owner]);
    const optionStatus = getRaidCharacterOptionStatus(plan, character, raidPlans);
    if (optionStatus.isDuplicate) {
      option.className = "is-duplicate-option";
      option.style.color = "var(--danger)";
    } else if (optionStatus.isExtra) {
      option.className = "is-extra-option";
      option.style.color = "var(--option-extra)";
    }
    select.add(option);
  }
  select.addEventListener("change", () => {
    if (scope === "saved") updateSavedRaidPlanCharacterLocal(plan.id, owner, select.value);
    else updateRaidPlanCharacter(plan.id, owner, select.value);
  });
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
  state.raidPlanDrafts.push({
    id: createId("raid"),
    raidName,
    completed: false,
    characters: Object.fromEntries(owners.map((owner) => [owner, ""])),
  });
  renderRaidPlanner();
  renderMissingRaidBoard();
}

async function saveRaidPlanChanges() {
  if (!validateRaidPlanDrafts()) return;
  state.raidPlans = mergeRaidPlans(state.raidPlans, state.raidPlanDrafts);
  saveRaidPlans();
  elements.saveRaidPlanButton.disabled = true;
  elements.saveRaidPlanBottomButton.disabled = true;
  showSavingOverlay("저장중...");
  const ok = await saveRaidPlansState();
  elements.saveRaidPlanButton.disabled = false;
  elements.saveRaidPlanBottomButton.disabled = false;
  hideSavingOverlay();
  if (ok) state.raidPlanDrafts = [];
  state.selectedRaidPlanIds.clear();
  state.editingRaidPlanIds.clear();
  state.raidPlanEditBackup = null;
  renderRaidPlanner();
  renderMissingRaidBoard();
  setStatus(ok ? "레이드 편성 저장 완료" : "레이드 편성 저장 실패", ok ? "success" : "error");
}

function validateRaidPlanDrafts() {
  const invalid = [...getRaidPlanRows(state.raidPlanDrafts), ...getRaidPlanRows(state.raidPlans)].some((plan) => {
    const hasRaidName = Boolean(plan.raidName?.trim());
    const hasCharacter = Object.values(plan.characters ?? {}).some(Boolean);
    return hasRaidName && !hasCharacter;
  });

  if (invalid) {
    alert("[\uCE90\uB9AD\uD130\uAC00 \uC9C0\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4]");
    return false;
  }

  return true;
}

function removeRaidPlanRow(id) {
  state.raidPlanDrafts = state.raidPlanDrafts.filter((plan) => plan.id !== id);
  renderRaidPlanner();
  renderMissingRaidBoard();
}

function updateRaidPlan(id, patch, shouldRender = true) {
  state.raidPlanDrafts = getRaidPlanRows(state.raidPlanDrafts).map((plan) => (plan.id === id ? { ...plan, ...patch } : plan));
  if (shouldRender) {
    renderRaidPlanner();
    renderMissingRaidBoard();
  } else {
    renderRaidPlanSummary();
  }
}

function updateRaidPlanCharacter(id, owner, key) {
  state.raidPlanDrafts = getRaidPlanRows(state.raidPlanDrafts).map((plan) => {
    if (plan.id !== id) return plan;
    return { ...plan, characters: { ...(plan.characters ?? {}), [owner]: key } };
  });
  renderRaidPlanner();
  renderMissingRaidBoard();
}

async function updateSavedRaidPlan(id, patch) {
  state.raidPlans = getRaidPlanRows(state.raidPlans).map((plan) => (plan.id === id ? { ...plan, ...patch } : plan));
  saveRaidPlans();
  renderRaidPlanner();
  renderMissingRaidBoard();
  await saveRaidPlansState();
}

function updateSavedRaidPlanLocal(id, patch, shouldRender = true) {
  state.raidPlans = getRaidPlanRows(state.raidPlans).map((plan) => (plan.id === id ? { ...plan, ...patch } : plan));
  if (shouldRender) {
    renderRaidPlanner();
    renderMissingRaidBoard();
  } else {
    renderRaidPlanSummary();
  }
}

function updateSavedRaidPlanCharacterLocal(id, owner, key) {
  state.raidPlans = getRaidPlanRows(state.raidPlans).map((plan) => {
    if (plan.id !== id) return plan;
    return { ...plan, characters: { ...(plan.characters ?? {}), [owner]: key } };
  });
  renderRaidPlanner();
  renderMissingRaidBoard();
}

function selectRaidPlanRow(id) {
  if (state.editingRaidPlanIds.has(id)) return;
  if (state.selectedRaidPlanIds.has(id)) {
    state.selectedRaidPlanIds.delete(id);
    state.editingRaidPlanIds.delete(id);
  } else {
    state.selectedRaidPlanIds.add(id);
  }
  renderRaidPlanner();
  renderMissingRaidBoard();
}

function editSelectedRaidPlan() {
  pruneRaidPlanSelection();
  const selectedIds = [...state.selectedRaidPlanIds];
  if (!selectedIds.length) return;
  if (!state.raidPlanEditBackup) state.raidPlanEditBackup = cloneRaidPlans(state.raidPlans);

  const allSelectedEditing = selectedIds.every((id) => state.editingRaidPlanIds.has(id));
  if (allSelectedEditing) {
    selectedIds.forEach((id) => state.editingRaidPlanIds.delete(id));
  } else {
    selectedIds.forEach((id) => state.editingRaidPlanIds.add(id));
  }
  renderRaidPlanner();
  renderMissingRaidBoard();
}

function cancelRaidEdits() {
  if (state.raidPlanEditBackup) state.raidPlans = cloneRaidPlans(state.raidPlanEditBackup);
  state.selectedRaidPlanIds.clear();
  state.editingRaidPlanIds.clear();
  state.raidPlanEditBackup = null;
  state.raidPlanFilter = null;
  renderRaidPlanner();
  renderMissingRaidBoard();
}

function cancelRaidDrafts() {
  state.raidPlanDrafts = [];
  state.raidPlanFilter = null;
  renderRaidPlanner();
  renderMissingRaidBoard();
}

async function deleteSelectedRaidPlan() {
  pruneRaidPlanSelection();
  if (!state.selectedRaidPlanIds.size) return;
  const selectedIds = new Set(state.selectedRaidPlanIds);
  state.raidPlans = state.raidPlans.filter((plan) => !selectedIds.has(plan.id));
  state.raidPlanDrafts = state.raidPlanDrafts.filter((plan) => !selectedIds.has(plan.id));
  state.selectedRaidPlanIds.clear();
  state.editingRaidPlanIds.clear();
  state.raidPlanEditBackup = null;
  saveRaidPlans();
  showSavingOverlay("저장중...");
  const ok = await saveRaidPlansState();
  hideSavingOverlay();
  renderRaidPlanner();
  renderMissingRaidBoard();
  setStatus(ok ? "레이드 편성 삭제 완료" : "레이드 편성 삭제 실패", ok ? "success" : "error");
}

function reorderSavedRaidPlan(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const rows = [...state.raidPlans];
  const sourceIndex = rows.findIndex((plan) => plan.id === sourceId);
  const targetIndex = rows.findIndex((plan) => plan.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [moved] = rows.splice(sourceIndex, 1);
  rows.splice(targetIndex, 0, moved);
  state.raidPlans = rows;
  state.draggingRaidPlanId = null;
  saveRaidPlans();
  saveSheetState();
  renderRaidPlanner();
  renderMissingRaidBoard();
}

function pruneRaidPlanSelection() {
  const savedIds = new Set(state.raidPlans.map((plan) => plan.id));
  state.selectedRaidPlanIds = new Set([...state.selectedRaidPlanIds].filter((id) => savedIds.has(id)));
  state.editingRaidPlanIds = new Set([...state.editingRaidPlanIds].filter((id) => savedIds.has(id) && state.selectedRaidPlanIds.has(id)));
}

async function resetRaidCompleted() {
  state.raidPlans = state.raidPlans.map((plan) => ({ ...plan, completed: false }));
  state.raidPlanDrafts = state.raidPlanDrafts.map((plan) => ({ ...plan, completed: false }));
  saveRaidPlans();
  const ok = await saveRaidPlansState();
  renderRaidPlanner();
  renderMissingRaidBoard();
  setStatus(ok ? "레이드 체크 초기화 완료" : "레이드 체크 초기화 실패", ok ? "success" : "error");
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

function getRaidPlanCellStatus(plan, character, raidPlans = state.raidPlanDrafts) {
  const raidName = plan.raidName?.trim();
  const recommended = getRecommendedRaids(character);
  const extra = getExtraRaids(character);
  const sameRaidCount = getRaidPlanRows(raidPlans).filter((row) => {
    if (row.excluded || row.raidName !== raidName) return false;
    return Object.values(row.characters ?? {}).includes(character.key);
  }).length;
  return {
    isExtra: extra.includes(raidName),
    isExcluded: Boolean(plan.excluded) || (!!raidName && !recommended.includes(raidName) && !extra.includes(raidName)),
    isDuplicate: sameRaidCount > 1,
  };
}

function getRaidCharacterOptionStatus(plan, character, raidPlans) {
  const raidName = plan.raidName?.trim();
  const sameRaidCount = getRaidPlanRows(raidPlans).filter((row) => {
    if (row.id === plan.id || row.excluded || row.raidName !== raidName) return false;
    return Object.values(row.characters ?? {}).includes(character.key);
  }).length;
  return {
    isDuplicate: sameRaidCount > 0,
    isExtra: getExtraRaids(character).includes(raidName),
  };
}

function canJoinRaid(character, raidName) {
  if (!raidName) return true;
  const recommendation = getRaidRecommendation(character);
  return recommendation.primary.includes(raidName) || recommendation.extra.includes(raidName);
}

function getRaidTier(raidName) {
  return raidCatalog.find((raid) => raid.name === raidName)?.tier ?? "base";
}

function getRaidColorIndex(raidName) {
  const catalogIndex = raidCatalog.findIndex((raid) => raid.name === raidName);
  if (catalogIndex >= 0) return (catalogIndex % 18) + 1;
  const source = String(raidName || "");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 997;
  }
  return (hash % 18) + 1;
}

function getRaidPlanRows(raidPlans = state.raidPlanDrafts) {
  const owners = getOwners();
  return normalizeRaidPlans(raidPlans).map((plan) => ({
    ...plan,
    characters: Object.fromEntries(owners.map((owner) => [owner, plan.characters?.[owner] ?? ""])),
  }));
}

function getFilteredRaidPlanRows(rows) {
  if (!state.raidPlanFilter) return rows;
  if (state.raidPlanFilter.type === "raid") {
    return rows.filter((plan) => plan.raidName === state.raidPlanFilter.value);
  }
  if (state.raidPlanFilter.type === "character") {
    return rows.filter((plan) => Object.values(plan.characters ?? {}).includes(state.raidPlanFilter.value));
  }
  return rows;
}

function getRaidFilterOptions() {
  return uniqueStrings(state.raidPlans.map((plan) => plan.raidName))
    .sort(compareRaidFilterOrder)
    .map((raidName) => ({ label: raidName, value: raidName }));
}

function compareRaidFilterOrder(a, b) {
  const aIndex = raidFilterOrder.indexOf(a);
  const bIndex = raidFilterOrder.indexOf(b);
  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
  if (aIndex >= 0) return -1;
  if (bIndex >= 0) return 1;
  return a.localeCompare(b, "ko-KR");
}

function getCharacterFilterOptions(owner) {
  const seen = new Set();
  return getRaidPlanRows(state.raidPlans)
    .map((plan) => plan.characters?.[owner])
    .filter(Boolean)
    .map((key) => findCharacterByKey(key))
    .filter(Boolean)
    .filter((character) => {
      if (seen.has(character.key)) return false;
      seen.add(character.key);
      return true;
    })
    .sort(compareCharacters)
    .map((character) => ({ label: character.characterName, value: character.key }));
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
    state.raidPlanDrafts = [];
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

async function saveRaidPlansState() {
  try {
    const response = await fetch("/api/state", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raidPlans: state.raidPlans }),
    });
    state.isRemoteReady = response.ok;
    return response.ok;
  } catch {
    state.isRemoteReady = false;
    return false;
  }
}

function showSavingOverlay(message = "저장중...") {
  elements.savingOverlay.querySelector(".saving-panel").textContent = message;
  elements.savingOverlay.hidden = false;
}

function hideSavingOverlay() {
  elements.savingOverlay.hidden = true;
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
    if (ownerOptions.some((defaultOwner) => defaultOwner !== owner && queryName.startsWith(defaultOwner))) return null;
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
      completed: Boolean(plan?.completed),
      characters: Object.fromEntries(Object.entries(characters).map(([owner, key]) => [String(owner), String(key ?? "")])),
    };
  }).filter((plan) => plan.raidName || Object.values(plan.characters).some(Boolean));
}

function cloneRaidPlans(raidPlans) {
  return normalizeRaidPlans(raidPlans).map((plan) => ({
    ...plan,
    characters: { ...(plan.characters ?? {}) },
  }));
}

function mergeRaidPlans(savedPlans, draftPlans) {
  const plansById = new Map(cloneRaidPlans(savedPlans).map((plan) => [plan.id, plan]));
  for (const plan of cloneRaidPlans(draftPlans)) plansById.set(plan.id, plan);
  return Array.from(plansById.values());
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
