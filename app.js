// 상수, 상태, DOM 요소, 이벤트 연결, 초기 로딩
const minItemLevel = 1700;
const maxAlbumImages = 14;
const maxUploadImageBytes = 4 * 1024 * 1024;
const albumGridSlots = maxAlbumImages + 1;
const remoteSyncIntervalMs = 60_000;
let missingPaneResizeObserver = null;
let auctionPartySize = 8;
let remoteSyncTimer = null;
let siteToastTimer = null;
const storageKeys = {
  accounts: "raidsheet:accounts:v4",
  legacyAccounts: "raidsheet:accounts:v3",
  assignments: "raidsheet:assignments:v2",
  raidPlans: "raidsheet:raid-plans:v1",
  albumImages: "raidsheet:album-images:v1",
  memoNotes: "raidsheet:memo-notes:v1",
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
  albumImages: loadAlbumImages(),
  memoNotes: loadMemoNotes(),
  selectedRaidPlanIds: new Set(),
  editingRaidPlanIds: new Set(),
  raidPlanEditBackup: null,
  draggingRaidPlanId: null,
  raidPlanFilter: null,
  missingRaidOwnerFilter: "",
  missingRaidTypeFilter: "primary",
  isLoading: false,
  isRemoteReady: false,
  lastUpdatedAt: null,
  lastRemoteUpdatedAt: null,
  isSavingRemote: false,
};

const elements = {
  refreshButton: document.querySelector("#refresh-button"),
  ownedRefreshButton: document.querySelector("#owned-refresh-button"),
  saveRosterButton: document.querySelector("#save-roster-button"),
  editAccountsButton: document.querySelector("#edit-accounts-button"),
  openRosterButton: document.querySelector("#open-roster-button"),
  accountsDialog: document.querySelector("#accounts-dialog"),
  rosterDialog: document.querySelector("#roster-dialog"),
  accountEditor: document.querySelector("#account-editor"),
  addAccountButton: document.querySelector("#add-account-button"),
  saveAccountsButton: document.querySelector("#save-accounts-button"),
  status: document.querySelector("#status"),
  ownedStatus: document.querySelector("#owned-status"),
  savingOverlay: document.querySelector("#saving-overlay"),
  siteToast: document.querySelector("#site-toast"),
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
  raidMissingPane: document.querySelector(".raid-missing-pane"),
  raidSideMissingBoard: document.querySelector("#raid-side-missing-board"),
  missingRaidOwnerFilter: document.querySelector("#missing-raid-owner-filter"),
  missingRaidTypeFilter: document.querySelector("#missing-raid-type-filter"),
  resetMissingFilterButton: document.querySelector("#reset-missing-filter-button"),
  raidPlanHead: document.querySelector("#raid-plan-head"),
  raidPlanBody: document.querySelector("#raid-plan-body"),
  raidPlanSummary: document.querySelector("#raid-plan-summary"),
  albumBoard: document.querySelector("#album-board"),
  albumUploadInput: document.querySelector("#album-upload-input"),
  addAlbumButton: document.querySelector("#add-album-button"),
  albumCount: document.querySelector("#album-count"),
  albumPreviewDialog: document.querySelector("#album-preview-dialog"),
  albumPreviewImage: document.querySelector("#album-preview-image"),
  albumPreviewCloseButton: document.querySelector("#album-preview-close-button"),
  auctionCalculatorButton: document.querySelector("#auction-calculator-button"),
  auctionCalculatorDialog: document.querySelector("#auction-calculator-dialog"),
  auctionCloseButton: document.querySelector("#auction-close-button"),
  auctionPriceInput: document.querySelector("#auction-price-input"),
  auctionPartyInput: document.querySelector("#auction-party-input"),
  auctionPartyButtons: [...document.querySelectorAll("[data-party-size]")],
  auctionResultTable: document.querySelector("#auction-result-table"),
  auctionCopyHint: document.querySelector("#auction-copy-hint"),
  addMemoButton: document.querySelector("#add-memo-button"),
  memoBoard: document.querySelector("#memo-board"),
  memoDialog: document.querySelector("#memo-dialog"),
  memoAuthorInput: document.querySelector("#memo-author-input"),
  memoContentInput: document.querySelector("#memo-content-input"),
  memoError: document.querySelector("#memo-error"),
  saveMemoButton: document.querySelector("#save-memo-button"),
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
elements.ownedRefreshButton?.addEventListener("click", () => loadRosters({ refresh: true }));
elements.saveRosterButton.addEventListener("click", saveRosterChanges);
elements.editAccountsButton.addEventListener("click", openAccountEditor);
elements.openRosterButton.addEventListener("click", openRosterDialog);
elements.addAccountButton.addEventListener("click", addAccountEditorRow);
elements.saveAccountsButton.addEventListener("click", saveAccountEditor);
elements.addAlbumButton?.addEventListener("click", () => {
  if (state.albumImages.length >= maxAlbumImages) {
    showAlbumLimitAlert();
    return;
  }
  elements.albumUploadInput?.click();
});
elements.albumUploadInput?.addEventListener("change", (event) => addAlbumImages(event.target.files));
elements.albumPreviewCloseButton?.addEventListener("click", () => elements.albumPreviewDialog?.close());
elements.albumPreviewDialog?.addEventListener("click", (event) => {
  if (event.target === elements.albumPreviewDialog) elements.albumPreviewDialog.close();
});
elements.auctionCalculatorButton?.addEventListener("click", openAuctionCalculator);
elements.auctionCloseButton?.addEventListener("click", () => elements.auctionCalculatorDialog?.close());
elements.auctionPriceInput?.addEventListener("input", renderAuctionCalculator);
elements.auctionPartyInput?.addEventListener("input", () => {
  const value = Number.parseInt(elements.auctionPartyInput.value, 10);
  if (Number.isFinite(value) && value >= 2) auctionPartySize = value;
  updateAuctionPartyButtons();
  renderAuctionCalculator();
});
for (const button of elements.auctionPartyButtons) {
  button.addEventListener("click", () => {
    auctionPartySize = Number.parseInt(button.dataset.partySize, 10);
    if (elements.auctionPartyInput) elements.auctionPartyInput.value = "";
    updateAuctionPartyButtons();
    renderAuctionCalculator();
  });
}
elements.addRaidRowButton.addEventListener("click", addRaidPlanRow);
elements.saveRaidPlanButton.addEventListener("click", saveSavedRaidPlanChanges);
elements.saveRaidPlanBottomButton.addEventListener("click", saveRaidDraftChanges);
elements.editRaidRowButton.addEventListener("click", editSelectedRaidPlan);
elements.deleteRaidRowButton.addEventListener("click", deleteSelectedRaidPlan);
elements.cancelRaidEditButton.addEventListener("click", cancelRaidEdits);
elements.cancelRaidDraftButton.addEventListener("click", cancelRaidDrafts);
elements.resetRaidCompleteButton.addEventListener("click", resetRaidCompleted);
elements.missingRaidOwnerFilter?.addEventListener("change", () => {
  state.missingRaidOwnerFilter = elements.missingRaidOwnerFilter.value;
  renderMissingRaidBoard();
});
elements.missingRaidTypeFilter?.addEventListener("change", () => {
  state.missingRaidTypeFilter = elements.missingRaidTypeFilter.value;
  renderMissingRaidBoard();
});
elements.resetMissingFilterButton?.addEventListener("click", () => {
  state.missingRaidOwnerFilter = "";
  state.missingRaidTypeFilter = "primary";
  renderMissingRaidBoard();
});
elements.addMemoButton?.addEventListener("click", openMemoDialog);
elements.saveMemoButton?.addEventListener("click", saveMemoFromDialog);
for (const button of elements.tabButtons) {
  button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
}

renderAll();
initializeApp();

async function initializeApp() {
  await loadSheetState();
  initializeMissingPaneHeightSync();
  await loadRosters();
  startRemoteSync();
}

async function loadRosters(options = {}) {
  if (state.isLoading) return;

  state.isLoading = true;
  setRefreshButtonsDisabled(true);
  setCharacterLoadStatus(options.refresh ? "새로 조회 중" : "자동 조회 중", "loading");
  renderRosterBoard(true);

  try {
    const results = await Promise.all(state.accounts.map((account) => fetchAccountRoster(account, options)));
    state.rosters = results;
    state.lastUpdatedAt = new Date();
    pruneAssignments();
    const assignmentsUpdated = syncAssignmentsWithLatestRoster();
    if (options.refresh && assignmentsUpdated && state.isRemoteReady) await saveSheetState();
  } catch (error) {
    setCharacterLoadStatus(error.message || "조회에 실패했습니다.", "error");
  } finally {
    state.isLoading = false;
    setRefreshButtonsDisabled(false);
    renderAll();
    renderStatus();
  }
}

function setRefreshButtonsDisabled(disabled) {
  if (elements.refreshButton) elements.refreshButton.disabled = disabled;
  if (elements.ownedRefreshButton) elements.ownedRefreshButton.disabled = disabled;
}
async function fetchAccountRoster(account, options = {}) {
  const params = new URLSearchParams({ characterName: account.queryName });
  if (options.refresh) params.set("refresh", "1");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`/api/roster?${params.toString()}`, { signal: controller.signal });
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
    if (error?.name === "AbortError") {
      return { account, ok: false, error: "조회 시간이 초과됐습니다.", characters: [] };
    }
    return { account, ok: false, error: error.message, characters: [] };
  } finally {
    clearTimeout(timeout);
  }
}

// 기본 렌더링, 보유 캐릭터 탭, 캐릭터 조회/편성 목록
function renderAll() {
  [
    renderSummary,
    renderProfileBoard,
    renderAssignmentBoard,
    renderRosterBoard,
    renderRaidPlanner,
    renderMissingRaidBoard,
    renderAlbumBoard,
    renderMemoBoard,
  ].forEach((render) => {
    try {
      render();
    } catch (error) {
      console.error(error);
    }
  });
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

// 누락 레이드 사이드 패널과 누락 레이드 필터
function renderMissingRaidBoard() {
  renderMissingRaidOwnerFilter();
  const selectedOwner = state.missingRaidOwnerFilter;
  const owners = selectedOwner ? getOwners().filter((owner) => owner === selectedOwner) : getOwners();
  const cards = owners.map((owner) => {
    try {
      return createMissingOwnerCard(owner);
    } catch (error) {
      console.error(error);
      return createMissingErrorCard(owner, error);
    }
  }).filter(Boolean);
  if (elements.raidSideMissingBoard) elements.raidSideMissingBoard.replaceChildren(...cards);
  syncMissingPaneHeight();
}

function createMissingErrorCard(owner, error) {
  const card = document.createElement("article");
  card.className = "missing-owner-card";
  const heading = document.createElement("div");
  heading.className = "missing-owner-heading";
  const image = document.createElement("img");
  image.className = "owner-avatar";
  image.src = getOwnerAvatarUrl(owner);
  image.alt = "";
  const title = document.createElement("h3");
  title.textContent = getRaidTableDisplayName(owner);
  heading.append(image, title);
  const body = document.createElement("div");
  body.className = "missing-owner-body";
  const message = document.createElement("p");
  message.className = "missing-empty";
  message.textContent = error?.message || "누락 레이드를 계산할 수 없습니다.";
  body.append(message);
  card.append(heading, body);
  return card;
}

function renderMissingRaidOwnerFilter() {
  if (!elements.missingRaidOwnerFilter) return;
  const currentValue = state.missingRaidOwnerFilter;
  elements.missingRaidOwnerFilter.replaceChildren(new Option("전체", ""));
  getOwners().forEach((owner) => elements.missingRaidOwnerFilter.add(new Option(getRaidTableDisplayName(owner), owner, owner === currentValue, owner === currentValue)));
  elements.missingRaidOwnerFilter.value = currentValue;
  if (elements.missingRaidTypeFilter) elements.missingRaidTypeFilter.value = state.missingRaidTypeFilter;
}

function getMissingCompleteMessage() {
  if (state.missingRaidTypeFilter === "primary") return "필수 레이드가 모두 편성되었습니다.";
  if (state.missingRaidTypeFilter === "extra") return "추가 레이드가 모두 편성되었습니다.";
  return "필수/추가 레이드가 모두 편성되었습니다.";
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
  title.textContent = getRaidTableDisplayName(owner);
  heading.append(image, title);

  const characters = getCharactersForOwner(owner);
  const rows = characters
    .map((character) => ({ character, missing: filterMissingRaidsByType(getMissingRaidsForCharacter(character)) }))
    .filter((row) => row.missing.primary.length || row.missing.extra.length);

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
    message.textContent = getMissingCompleteMessage();
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
  name.textContent = getRaidTableDisplayName(character.characterName);
  const meta = document.createElement("span");
  meta.textContent = character.characterClassName + " · " + character.itemAvgLevel;
  main.append(name, meta);

  row.append(main);
  if (state.missingRaidTypeFilter !== "extra") row.append(createMissingRaidGroup("필수 레이드", missing.primary, "primary"));
  if (state.missingRaidTypeFilter !== "primary") row.append(createMissingRaidGroup("추가 레이드", missing.extra, "extra"));
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

function filterMissingRaidsByType(missing) {
  if (state.missingRaidTypeFilter === "primary") return { primary: missing.primary, extra: [] };
  if (state.missingRaidTypeFilter === "extra") return { primary: [], extra: missing.extra };
  return missing;
}

function getPlannedRaidsForCharacter(characterKey) {
  const planned = new Set();
  for (const plan of getRaidPlanRows(state.raidPlans)) {
    if (plan.excluded || !plan.raidName) continue;
    if (Object.values(plan.characters ?? {}).includes(characterKey)) planned.add(plan.raidName);
  }
  return planned;
}

// 레이드 편성 표, 편집/저장/필터/순서 변경
function renderRaidPlanner() {
  const owners = getOwners();
  renderSavedRaidPlanner(owners);
  renderRaidEditor(owners);
  renderRaidPlanActions();
  syncMissingPaneHeight();
}

function syncMissingPaneHeight() {
  if (!elements.raidSavedBoard || !elements.raidMissingPane) return;
  const table = elements.raidSavedBoard.querySelector(".raid-saved-table");
  const target = table ?? elements.raidSavedBoard.firstElementChild ?? elements.raidSavedBoard;
  const targetHeight = target.getBoundingClientRect().height;
  const style = getComputedStyle(elements.raidSavedBoard);
  const chromeHeight =
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) +
    parseFloat(style.borderBottomWidth);
  const savedHeight = Math.ceil(targetHeight + chromeHeight);
  if (savedHeight > 0) elements.raidMissingPane.style.height = `${savedHeight}px`;
}

function initializeMissingPaneHeightSync() {
  if (!elements.raidSavedBoard || !elements.raidMissingPane || missingPaneResizeObserver) return;
  missingPaneResizeObserver = new ResizeObserver(() => syncMissingPaneHeight());
  missingPaneResizeObserver.observe(elements.raidSavedBoard);
  window.addEventListener("resize", syncMissingPaneHeight);
  syncMissingPaneHeight();
}

function renderSavedRaidPlanner(owners) {
  const rows = getFilteredRaidPlanRows(getRaidPlanRows(state.raidPlans));

  if (!rows.length) {
    const message = document.createElement("p");
    message.className = "column-message raid-saved-empty";
    message.textContent = state.raidPlans.length ? "필터 조건에 맞는 레이드가 없습니다." : "아래에서 레이드를 추가하고 저장하면 편성표가 표시됩니다.";
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

  headRow.append(createTableHeader("순서"), createCompletedHeaderCell(), createRaidHeaderCell());

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
  cell.append(createFilterHeaderContent("레이드", "raid", getRaidFilterOptions(), getRaidFilterValue()));
  return cell;
}

function createOwnerRaidHeaderCell(owner) {
  const cell = createTableHeader("");
  cell.append(createFilterHeaderContent(getRaidTableDisplayName(owner), "character", getOwnerFilterOptions(owner), getOwnerFilterValue(owner), owner));
  return cell;
}

function createFilterHeaderContent(label, type, options, selectedValue, owner = "") {
  const wrap = document.createElement("div");
  wrap.className = type === "character" ? "raid-filter-heading owner-filter-heading" : "raid-filter-heading";

  if (type === "character") {
    const image = document.createElement("img");
    image.className = "owner-avatar";
    image.src = getOwnerAvatarUrl(owner);
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
    updateRaidPlanFilter(type, select.value, owner);
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

function createCompletedHeaderCell() {
  const cell = createTableHeader("");
  cell.append(createFilterHeaderContent("완료", "status", getStatusFilterOptions(), getStatusFilterValue()));
  return cell;
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
  completed.addEventListener("change", () => updateSavedRaidPlanCompleted(plan.id, completed.checked));
  completedCell.append(completed);
  completedCell.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === completed) return;
    completed.checked = !completed.checked;
    updateSavedRaidPlanCompleted(plan.id, completed.checked);
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
  name.textContent = getRaidTableDisplayName(character.characterName);
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
  const selectedCharacterKey = plan.characters?.[owner] ?? "";
  const selectableCharacters = getCharactersForOwner(owner).filter((item) => canJoinRaid(item, plan.raidName) || item.key === selectedCharacterKey);
  for (const character of selectableCharacters) {
    const option = new Option(getRaidTableDisplayName(character.characterName), character.key, character.key === plan.characters?.[owner], character.key === plan.characters?.[owner]);
    const optionStatus = getRaidCharacterOptionStatus(plan, character, raidPlans);
    const cellStatus = getRaidPlanCellStatus({ ...plan, characters: { ...(plan.characters ?? {}), [owner]: character.key } }, character, raidPlans);
    if (optionStatus.isDuplicate || cellStatus.isExcluded) {
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
  renderAlbumBoard();
}


async function saveSavedRaidPlanChanges() {
  state.raidPlans = removeEmptyRaidPlans(state.raidPlans);
  saveRaidPlans();
  elements.saveRaidPlanButton.disabled = true;
  showSavingOverlay("편성 저장중...");
  const ok = await saveRaidPlansState();
  elements.saveRaidPlanButton.disabled = false;
  hideSavingOverlay();
  if (ok) {
    state.selectedRaidPlanIds.clear();
    state.editingRaidPlanIds.clear();
    state.raidPlanEditBackup = null;
  }
  renderRaidPlanner();
  renderMissingRaidBoard();
  setStatus(ok ? "레이드 편성 수정 저장 완료" : "레이드 편성 수정 저장 실패", ok ? "success" : "error");
}
async function saveRaidDraftChanges() {
  if (!validateRaidPlanDrafts()) return;
  state.raidPlans = mergeRaidPlans(state.raidPlans, state.raidPlanDrafts);
  saveRaidPlans();
  elements.saveRaidPlanBottomButton.disabled = true;
  showSavingOverlay("추가 저장중...");
  const ok = await saveRaidPlansState();
  elements.saveRaidPlanBottomButton.disabled = false;
  hideSavingOverlay();
  if (ok) state.raidPlanDrafts = [];
  renderRaidPlanner();
  renderMissingRaidBoard();
  setStatus(ok ? "레이드 추가 저장 완료" : "레이드 추가 저장 실패", ok ? "success" : "error");
}

function validateRaidPlans(raidPlans) {
  const invalid = getRaidPlanRows(raidPlans).some((plan) => {
    const hasRaidName = Boolean(plan.raidName?.trim());
    const hasCharacter = Object.values(plan.characters ?? {}).some(Boolean);
    return hasRaidName && !hasCharacter;
  });

  if (invalid) {
    alert("[캐릭터가 지정되지 않았습니다]");
    return false;
  }

  return true;
}

function removeEmptyRaidPlans(raidPlans) {
  return getRaidPlanRows(raidPlans).filter((plan) => {
    const hasRaidName = Boolean(plan.raidName?.trim());
    const hasCharacter = Object.values(plan.characters ?? {}).some(Boolean);
    return hasRaidName || hasCharacter;
  });
}

function validateRaidPlanDrafts() {
  return validateRaidPlans(state.raidPlanDrafts);
}

function removeRaidPlanRow(id) {
  state.raidPlanDrafts = state.raidPlanDrafts.filter((plan) => plan.id !== id);
  renderRaidPlanner();
  renderMissingRaidBoard();
  renderAlbumBoard();
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
  renderAlbumBoard();
}

async function updateSavedRaidPlan(id, patch) {
  state.raidPlans = getRaidPlanRows(state.raidPlans).map((plan) => (plan.id === id ? { ...plan, ...patch } : plan));
  saveRaidPlans();
  renderRaidPlanner();
  renderMissingRaidBoard();
  await saveRaidPlansState();
}

function updateSavedRaidPlanLocal(id, patch, shouldRender = true) {
  ensureRaidPlanEditBackup();
  state.raidPlans = getRaidPlanRows(state.raidPlans).map((plan) => (plan.id === id ? { ...plan, ...patch } : plan));
  if (shouldRender) {
    renderRaidPlanner();
    renderMissingRaidBoard();
  } else {
    renderRaidPlanSummary();
  }
}

async function updateSavedRaidPlanCompleted(id, completed) {
  state.raidPlans = getRaidPlanRows(state.raidPlans).map((plan) => (plan.id === id ? { ...plan, completed } : plan));
  saveRaidPlans();
  renderRaidPlanner();
  renderMissingRaidBoard();
  const ok = await saveRaidPlansState();
  if (!ok) setStatus("완료 체크 저장에 실패했습니다.", "error");
}

function updateSavedRaidPlanCharacterLocal(id, owner, key) {
  ensureRaidPlanEditBackup();
  state.raidPlans = getRaidPlanRows(state.raidPlans).map((plan) => {
    if (plan.id !== id) return plan;
    return { ...plan, characters: { ...(plan.characters ?? {}), [owner]: key } };
  });
  renderRaidPlanner();
  renderMissingRaidBoard();
  renderAlbumBoard();
}

function selectRaidPlanRow(id) {
  if (state.editingRaidPlanIds.size && !state.editingRaidPlanIds.has(id)) {
    showSiteToast("\uC218\uC815\uC911\uC785\uB2C8\uB2E4");
    return;
  }

  if (state.editingRaidPlanIds.has(id)) return;
  if (state.selectedRaidPlanIds.has(id)) {
    state.selectedRaidPlanIds.delete(id);
    state.editingRaidPlanIds.delete(id);
  } else {
    state.selectedRaidPlanIds.add(id);
  }
  renderRaidPlanner();
  renderMissingRaidBoard();
  renderAlbumBoard();
}

function ensureRaidPlanEditBackup() {
  if (!state.raidPlanEditBackup) state.raidPlanEditBackup = cloneRaidPlans(state.raidPlans);
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
  renderAlbumBoard();
}

function cancelRaidEdits() {
  if (state.raidPlanEditBackup) state.raidPlans = cloneRaidPlans(state.raidPlanEditBackup);
  state.selectedRaidPlanIds.clear();
  state.editingRaidPlanIds.clear();
  state.raidPlanEditBackup = null;
  state.raidPlanFilter = null;
  renderRaidPlanner();
}

function cancelRaidDrafts() {
  state.raidPlanDrafts = [];
  renderRaidPlanner();
}

function deleteSelectedRaidPlan() {
  pruneRaidPlanSelection();
  if (!state.selectedRaidPlanIds.size) return;
  ensureRaidPlanEditBackup();
  const selectedIds = new Set(state.selectedRaidPlanIds);
  state.raidPlans = state.raidPlans.filter((plan) => !selectedIds.has(plan.id));
  state.raidPlanDrafts = state.raidPlanDrafts.filter((plan) => !selectedIds.has(plan.id));
  state.selectedRaidPlanIds.clear();
  state.editingRaidPlanIds.clear();
  renderRaidPlanner();
  renderMissingRaidBoard();
  setStatus("삭제할 편성은 편성 저장을 누르면 반영됩니다.", "neutral");
}

function reorderSavedRaidPlan(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  ensureRaidPlanEditBackup();
  const rows = [...state.raidPlans];
  const sourceIndex = rows.findIndex((plan) => plan.id === sourceId);
  const targetIndex = rows.findIndex((plan) => plan.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [item] = rows.splice(sourceIndex, 1);
  rows.splice(targetIndex, 0, item);
  state.raidPlans = rows;
  renderRaidPlanner();
  renderMissingRaidBoard();
  setStatus("순서 변경은 편성 저장을 누르면 반영됩니다.", "neutral");
}

function pruneRaidPlanSelection() {
  const savedIds = new Set(state.raidPlans.map((plan) => plan.id));
  state.selectedRaidPlanIds = new Set([...state.selectedRaidPlanIds].filter((id) => savedIds.has(id)));
  state.editingRaidPlanIds = new Set([...state.editingRaidPlanIds].filter((id) => savedIds.has(id) && state.selectedRaidPlanIds.has(id)));
}

function resetRaidCompleted() {
  ensureRaidPlanEditBackup();
  state.raidPlans = state.raidPlans.map((plan) => ({ ...plan, completed: false }));
  state.raidPlanDrafts = state.raidPlanDrafts.map((plan) => ({ ...plan, completed: false }));
  renderRaidPlanner();
  renderMissingRaidBoard();
  setStatus("체크 초기화는 편성 저장을 누르면 반영됩니다.", "neutral");
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

function syncAssignmentsWithLatestRoster() {
  const charactersByKey = new Map(getAllCharacters().map((character) => [character.key, character]));
  let changed = false;
  state.assignments = state.assignments.map((assignment) => {
    const latestCharacter = charactersByKey.get(assignment.key);
    if (!latestCharacter) return assignment;
    if (JSON.stringify(assignment.character) === JSON.stringify(latestCharacter)) return assignment;
    changed = true;
    return { ...assignment, character: latestCharacter };
  });
  if (changed) {
    saveAssignments();
    renderAll();
  }
  return changed;
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

  if (panelId === "raid-panel") requestAnimationFrame(syncMissingPaneHeight);
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

async function saveAccountEditor() {
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
  await saveSheetState();
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
  setCharacterLoadStatus(`${time} 기준 ${minItemLevel}+ ${total}명 조회${cacheText}`, "success");
}

function setStatus(message, tone = "neutral") {
  if (elements.status) {
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
  }
}

function setOwnedStatus(message, tone = "neutral") {
  if (elements.ownedStatus) {
    elements.ownedStatus.textContent = message;
    elements.ownedStatus.dataset.tone = tone;
  }
}

function setCharacterLoadStatus(message, tone = "neutral") {
  setStatus(message, tone);
  setOwnedStatus(message, tone);
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
  const normalizedRaidName = normalizeRaidNameForColor(raidName);
  return raidCatalog.find((raid) => raid.name === normalizedRaidName)?.tier ?? "base";
}

function getRaidColorIndex(raidName) {
  const normalizedRaidName = normalizeRaidNameForColor(raidName);
  const catalogIndex = raidCatalog.findIndex((raid) => raid.name === normalizedRaidName);
  if (catalogIndex >= 0) return (catalogIndex % 18) + 1;
  const source = String(normalizedRaidName || "");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 997;
  }
  return (hash % 18) + 1;
}

function normalizeRaidNameForColor(raidName) {
  const source = String(raidName || "").trim();
  const compact = source.replace(/\s+/g, "");
  const aliasMap = new Map([
    ["4노", "4막 노말"],
    ["4막노말", "4막 노말"],
    ["4하", "4막 하드"],
    ["4막하드", "4막 하드"],
    ["3하", "3막 하드"],
    ["3막하드", "3막 하드"],
    ["종노", "종막 노말"],
    ["종막노말", "종막 노말"],
    ["종하", "종막 하드"],
    ["종막하드", "종막 하드"],
    ["세노", "세르카 노말"],
    ["세르카노말", "세르카 노말"],
    ["세하", "세르카 하드"],
    ["세르카하드", "세르카 하드"],
    ["세나", "세르카 나메"],
    ["세르카나메", "세르카 나메"],
    ["성당1", "성당 1단계"],
    ["성당1단계", "성당 1단계"],
    ["성당2", "성당 2단계"],
    ["성당2단계", "성당 2단계"],
    ["성당3", "성당 3단계"],
    ["성당3단계", "성당 3단계"],
  ]);
  return aliasMap.get(compact) ?? source;
}

function getRaidPlanRows(raidPlans = state.raidPlanDrafts) {
  const owners = getOwners();
  return normalizeRaidPlans(raidPlans).map((plan) => ({
    ...plan,
    characters: Object.fromEntries(owners.map((owner) => [owner, plan.characters?.[owner] ?? ""])),
  }));
}

function getFilteredRaidPlanRows(rows) {
  const filters = getRaidPlanFilters();
  let filteredRows = rows;
  if (filters.raid) filteredRows = filteredRows.filter((plan) => plan.raidName === filters.raid.value);
  if (filters.status) filteredRows = filteredRows.filter((plan) => (filters.status.value === "completed" ? plan.completed : !plan.completed));
  if (filters.character?.type === "exclude-owner") filteredRows = filteredRows.filter((plan) => isRaidPlanOwnerExcludedByFilter(plan, filters.character.owner));
  if (filters.character?.type === "character") filteredRows = filteredRows.filter((plan) => plan.characters?.[filters.character.owner] === filters.character.value);
  return filteredRows;
}

function isRaidPlanOwnerExcludedByFilter(plan, owner) {
  const characterKey = plan.characters?.[owner];
  if (!characterKey) return true;

  const character = findCharacterByKey(characterKey);
  if (!character) return true;

  const status = getRaidPlanCellStatus(plan, character, state.raidPlans);
  return status.isExcluded || status.isDuplicate;
}

function updateRaidPlanFilter(type, value, owner = "") {
  const next = getRaidPlanFilters();
  if (type === "raid") {
    state.raidPlanFilter = value ? { raid: { type, owner, value }, character: null, status: null } : null;
    return;
  }

  next.raid = null;
  if (type === "status") next.status = value ? { type, owner, value } : null;
  if (type === "character") next.character = value ? createCharacterRaidPlanFilter(value, owner) : null;
  state.raidPlanFilter = next.raid || next.character || next.status ? next : null;
}

function createCharacterRaidPlanFilter(value, owner = "") {
  if (value === "__exclude_owner__") return { type: "exclude-owner", owner, value };
  return { type: "character", owner, value };
}

function getRaidPlanFilters() {
  const filter = state.raidPlanFilter;
  const empty = { raid: null, character: null, status: null };
  if (!filter) return empty;
  if ("raid" in filter || "character" in filter || "status" in filter) return { ...empty, ...filter };
  if (filter.type === "raid") return { ...empty, raid: filter };
  if (filter.type === "status") return { ...empty, status: filter };
  if (filter.type === "character" || filter.type === "exclude-owner") return { ...empty, character: filter };
  return empty;
}

function getRaidFilterValue() {
  return getRaidPlanFilters().raid?.value ?? "";
}

function getStatusFilterValue() {
  return getRaidPlanFilters().status?.value ?? "";
}

function getStatusFilterOptions() {
  return [
    { label: "완료", value: "completed" },
    { label: "미완료", value: "pending" },
  ];
}

function getOwnerFilterValue(owner) {
  const filter = getRaidPlanFilters().character;
  if (!filter || filter.owner !== owner) return "";
  if (filter.type === "exclude-owner") return "__exclude_owner__";
  if (filter.type === "character") return filter.value ?? "";
  return "";
}

function getOwnerFilterOptions(owner) {
  return [
    { label: `${getRaidTableDisplayName(owner)} 제외`, value: "__exclude_owner__" },
    ...getCharacterFilterOptions(owner),
  ];
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
    .map((character) => ({ label: getRaidTableDisplayName(character.characterName), value: character.key }));
}


function getRaidTableDisplayName(name) {
  const names = {
    "바들바글바들": "바들",
    "자네내가서폿이될상인가": "바홀라",
    "나는바드좋아": "난바좋",
    "겨라니와써요": "겨라니",
  };
  return names[name] ?? name;
}

// 공용 조회 헬퍼, 프로필 이미지, 앨범, 경매계산기, 메모
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
  if (file.size > maxUploadImageBytes) {
    showImageSizeExceededToast(file);
    setStatus("프로필 사진은 4MB 이하만 업로드할 수 있습니다.", "error");
    return;
  }

  showSavingOverlay("업로드중...");
  const dataUrl = await readFileAsDataUrl(file);
  preview.src = dataUrl;
  setOwnerAvatarUrl(owner, dataUrl);
  saveAccounts();
  renderAll();
  setStatus("프로필 사진 업로드중...", "loading");

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
    hideSavingOverlay();
    setStatus("프로필 사진 업로드 완료", "success");
  } catch (error) {
    hideSavingOverlay();
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

function showImageSizeExceededToast(file) {
  showSiteToast(`이미지가 너무 큽니다. ${file.name} (${formatFileSize(file.size)})는 4MB 이하로 줄여서 업로드해 주세요.`);
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0KB";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.ceil(bytes / 1024)}KB`;
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

function createAlbumUploadTile() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "album-upload-tile";
  const label = document.createElement("span");
  label.textContent = state.albumImages.length >= maxAlbumImages ? `최대 ${maxAlbumImages}장` : "사진 추가";
  button.append(label);
  button.addEventListener("click", () => {
    if (state.albumImages.length >= maxAlbumImages) {
      showAlbumLimitAlert();
      return;
    }
    elements.albumUploadInput?.click();
  });
  return button;
}

function renderAlbumBoard() {
  if (!elements.albumBoard) return;
  if (elements.albumCount) elements.albumCount.textContent = `${state.albumImages.length}/${maxAlbumImages}`;

  const cells = [createAlbumUploadTile()];

  cells.push(...state.albumImages.map((item) => {
    const card = document.createElement("article");
    card.className = "album-card";
    const image = document.createElement("img");
    image.src = item.url;
    card.addEventListener("click", () => openAlbumPreview(item));
    image.alt = item.name || "앨범 사진";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "album-remove-button";
    remove.setAttribute("aria-label", "앨범 사진 삭제");
    remove.textContent = "×";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeAlbumImage(item.id);
    });
    card.append(image, remove);
    return card;
  }));

  while (cells.length < albumGridSlots) {
    const placeholder = document.createElement("div");
    placeholder.className = "album-placeholder";
    cells.push(placeholder);
  }

  elements.albumBoard.replaceChildren(...cells.slice(0, albumGridSlots));
}

function openAlbumPreview(item) {
  if (!elements.albumPreviewDialog || !elements.albumPreviewImage) return;
  elements.albumPreviewImage.src = item.url;
  elements.albumPreviewImage.alt = item.name || "앨범 사진";
  elements.albumPreviewDialog.showModal();
}

function showAlbumLimitAlert() {
  alert(`앨범은 최대 ${maxAlbumImages}장까지만 등록할 수 있습니다. 삭제 후 다시 등록해 주세요.`);
}

function openAuctionCalculator() {
  if (!elements.auctionCalculatorDialog) return;
  updateAuctionPartyButtons();
  renderAuctionCalculator();
  elements.auctionCalculatorDialog.showModal();
  elements.auctionPriceInput?.focus();
  elements.auctionPriceInput?.select();
}

function updateAuctionPartyButtons() {
  for (const button of elements.auctionPartyButtons) {
    const partySize = Number.parseInt(button.dataset.partySize, 10);
    button.classList.toggle("is-active", partySize === auctionPartySize && !elements.auctionPartyInput?.value);
  }
}

function renderAuctionCalculator() {
  if (!elements.auctionResultTable) return;
  const price = Math.max(0, Number.parseInt(elements.auctionPriceInput?.value || "0", 10) || 0);
  const partySize = Math.max(2, auctionPartySize || 8);
  const breakEvenBid = Math.floor(price * 0.95 * ((partySize - 1) / partySize));
  const rows = [
    { label: "손익 분기점", bid: breakEvenBid, profit: 0 },
    { label: "25%", bid: Math.floor(breakEvenBid * 0.9758), profit: 0 },
    { label: "50%", bid: Math.floor(breakEvenBid * 0.9525), profit: 0 },
    { label: "75%", bid: Math.floor(breakEvenBid * 0.9303), profit: 0 },
    { label: "선점", bid: Math.floor(breakEvenBid * 0.9092), profit: 0 },
  ].map((row) => ({ ...row, profit: row.profit || Math.max(0, breakEvenBid - row.bid) }));

  const header = document.createElement("div");
  header.className = "auction-result-row auction-result-head";
  header.innerHTML = "<span>손익</span><span>/</span><span>입찰가</span>";

  const bodyRows = rows.map((row) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "auction-result-row";
    item.dataset.bid = String(row.bid);
    item.innerHTML = `
      <span>${formatAuctionGold(row.profit)}</span>
      <strong>${row.label}</strong>
      <span>${formatAuctionGold(row.bid)}</span>
    `;
    item.addEventListener("click", () => copyAuctionBid(row.bid));
    return item;
  });

  elements.auctionResultTable.replaceChildren(header, ...bodyRows);
}

function formatAuctionGold(value) {
  return `${Math.max(0, Math.floor(value)).toLocaleString("ko-KR")} G`;
}

async function copyAuctionBid(value) {
  try {
    await navigator.clipboard?.writeText(String(value));
    if (elements.auctionCopyHint) elements.auctionCopyHint.textContent = `${value.toLocaleString("ko-KR")} 복사 완료`;
  } catch {
    if (elements.auctionCopyHint) elements.auctionCopyHint.textContent = "복사할 수 없습니다";
  }
}

function openMemoDialog() {
  if (!elements.memoDialog) return;
  if (elements.memoAuthorInput) elements.memoAuthorInput.value = "";
  if (elements.memoContentInput) elements.memoContentInput.value = "";
  setMemoError("");
  elements.memoDialog.showModal();
  elements.memoAuthorInput?.focus();
}

async function saveMemoFromDialog() {
  const author = elements.memoAuthorInput?.value.trim() ?? "";
  const content = elements.memoContentInput?.value.trim() ?? "";
  setMemoError("");
  if (!author || !content) {
    setMemoError("내용을 입력해주세요");
    return;
  }
  if (content.length > 100) {
    setStatus("메모 내용은 100자 이하로 입력해 주세요.", "error");
    return;
  }

  showSavingOverlay("등록중...");
  const previousNotes = state.memoNotes;
  state.memoNotes = [
    {
      id: createId("memo"),
      author,
      content,
      createdAt: new Date().toISOString(),
    },
    ...state.memoNotes,
  ];
  try {
    saveMemoNotes();
    const ok = await saveSheetState();
    if (!ok) throw new Error("메모를 DB에 저장하지 못했습니다.");
    renderMemoBoard();
    elements.memoDialog?.close();
    setStatus("메모 등록 완료", "success");
  } catch (error) {
    state.memoNotes = previousNotes;
    saveMemoNotes();
    renderMemoBoard();
    setStatus(error.message || "메모 등록 실패", "error");
  } finally {
    hideSavingOverlay();
  }
}

function setMemoError(message) {
  if (!elements.memoError) return;
  elements.memoError.textContent = message;
  elements.memoError.hidden = !message;
}

function renderMemoBoard() {
  if (!elements.memoBoard) return;
  if (!state.memoNotes.length) {
    const empty = document.createElement("p");
    empty.className = "memo-empty";
    empty.textContent = "등록된 메모가 없습니다.";
    elements.memoBoard.replaceChildren(empty);
    return;
  }

  const notes = state.memoNotes.map((note) => {
    const card = document.createElement("article");
    card.className = "memo-card";
    const header = document.createElement("div");
    header.className = "memo-card-header";
    const author = document.createElement("strong");
    author.textContent = note.author;
    const time = document.createElement("span");
    time.textContent = formatMemoDate(note.createdAt);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "memo-remove-button";
    remove.setAttribute("aria-label", "메모 삭제");
    remove.textContent = "×";
    remove.addEventListener("click", () => removeMemoNote(note.id));
    header.append(author, time, remove);
    const content = document.createElement("p");
    content.textContent = note.content;
    card.append(header, content);
    return card;
  });

  elements.memoBoard.replaceChildren(...notes);
}

async function removeMemoNote(id) {
  showSavingOverlay("삭제중...");
  const previousNotes = state.memoNotes;
  state.memoNotes = state.memoNotes.filter((note) => note.id !== id);
  try {
    saveMemoNotes();
    const ok = await saveSheetState();
    if (!ok) throw new Error("메모를 DB에서 삭제하지 못했습니다.");
    renderMemoBoard();
    setStatus("메모 삭제 완료", "success");
  } catch (error) {
    state.memoNotes = previousNotes;
    saveMemoNotes();
    renderMemoBoard();
    setStatus(error.message || "메모 삭제 실패", "error");
  } finally {
    hideSavingOverlay();
  }
}

function formatMemoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function addAlbumImages(files) {
  const selectedFiles = [...(files ?? [])].filter((file) => file.type.startsWith("image/"));
  if (!selectedFiles.length) return;
  const oversizedFile = selectedFiles.find((file) => file.size > maxUploadImageBytes);
  if (oversizedFile) {
    showImageSizeExceededToast(oversizedFile);
    setStatus("\uC774\uBBF8\uC9C0\uB294 4MB \uC774\uD558\uB9CC \uC5C5\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", "error");
    if (elements.albumUploadInput) elements.albumUploadInput.value = "";
    return;
  }
  const slots = Math.max(0, maxAlbumImages - state.albumImages.length);
  if (!slots || selectedFiles.length > slots) {
    showAlbumLimitAlert();
    if (elements.albumUploadInput) elements.albumUploadInput.value = "";
    return;
  }

  const nextImages = [];
  showSavingOverlay("업로드중...");
  try {
    for (const file of selectedFiles) {
      const dataUrl = await readFileAsDataUrl(file);
      const url = await uploadAlbumImage(file, dataUrl);
      nextImages.push({ id: createId("album"), name: file.name, url });
    }

    state.albumImages = [...state.albumImages, ...nextImages].slice(0, maxAlbumImages);
    saveAlbumImages();
    await saveSheetState();
    renderAlbumBoard();
    if (elements.albumUploadInput) elements.albumUploadInput.value = "";
    hideSavingOverlay();
    setStatus("앨범 사진 추가 완료", "success");
  } catch (error) {
    hideSavingOverlay();
    setStatus(error.message || "앨범 사진 업로드 실패", "error");
  }
}

async function uploadAlbumImage(file, dataUrl) {
  const response = await fetch("/api/album-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, dataUrl }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "\uC568\uBC94 \uC0AC\uC9C4\uC744 Blob \uC800\uC7A5\uC18C\uC5D0 \uC5C5\uB85C\uB4DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
  return payload.url;
}

async function removeAlbumImage(id) {
  showSavingOverlay("삭제중...");
  const previousImages = state.albumImages;
  state.albumImages = state.albumImages.filter((item) => item.id !== id);
  try {
    saveAlbumImages();
    const ok = await saveSheetState();
    if (!ok) throw new Error("앨범 사진을 DB에서 삭제하지 못했습니다.");
    renderAlbumBoard();
    setStatus("앨범 사진 삭제 완료", "success");
  } catch (error) {
    state.albumImages = previousImages;
    saveAlbumImages();
    renderAlbumBoard();
    setStatus(error.message || "앨범 사진 삭제 실패", "error");
  } finally {
    hideSavingOverlay();
  }
}

function loadAlbumImages() {
  return normalizeAlbumImages(readJson(storageKeys.albumImages, []));
}

function saveAlbumImages() {
  writeJson(storageKeys.albumImages, state.albumImages);
}

function loadMemoNotes() {
  return normalizeMemoNotes(readJson(storageKeys.memoNotes, []));
}

function saveMemoNotes() {
  writeJson(storageKeys.memoNotes, state.memoNotes);
}

function loadAccounts() {
  const savedAccounts = normalizeAccounts(readJson(storageKeys.accounts, null));
  if (savedAccounts.length) return mergeDefaultAvatars(savedAccounts);
  const legacyAccounts = normalizeAccounts(readJson(storageKeys.legacyAccounts, null));
  if (legacyAccounts.length) return mergeDefaultAvatars(legacyAccounts);
  return defaultAccounts;
}

function saveAccounts() {
  writeJson(storageKeys.accounts, state.accounts);
}

function loadAssignments() {
  return readJson(storageKeys.assignments, []);
}

function saveAssignments() {
  writeJson(storageKeys.assignments, state.assignments);
}

function loadRaidPlans() {
  return normalizeRaidPlans(readJson(storageKeys.raidPlans, []));
}

function saveRaidPlans() {
  writeJson(storageKeys.raidPlans, state.raidPlans);
}

// 원격/로컬 저장소, 정규화, 공용 유틸리티
async function loadSheetState() {
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("remote state unavailable");
    const payload = await response.json();
    applyRemoteSheetState(payload, { resetDrafts: true });
    const migratedAvatars = await migrateAccountDataUrlAvatars();
    state.isRemoteReady = true;
    state.lastRemoteUpdatedAt = payload.updatedAt ?? null;
    renderAll();
    if (!payload.exists || migratedAvatars) await saveSheetState();
  } catch {
    state.isRemoteReady = false;
    renderAll();
  }
}

async function migrateAccountDataUrlAvatars() {
  const accountsWithDataUrl = state.accounts.filter((account) => String(account.avatarUrl ?? "").startsWith("data:image/"));
  if (!accountsWithDataUrl.length) return false;

  let didMigrate = false;
  for (const account of accountsWithDataUrl) {
    try {
      const avatarUrl = String(account.avatarUrl);
      const contentType = getDataUrlContentType(avatarUrl);
      const url = await uploadProfileDataUrl(`${account.owner || account.label || account.id || "profile"}.png`, contentType, avatarUrl);
      state.accounts = state.accounts.map((item) => (item.id === account.id ? { ...item, avatarUrl: url } : item));
      didMigrate = true;
    } catch (error) {
      console.error(error);
    }
  }

  if (didMigrate) saveAccounts();
  return didMigrate;
}

function getDataUrlContentType(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;,]+)[;,]/);
  return match?.[1] ?? "image/png";
}

async function uploadProfileDataUrl(fileName, contentType, dataUrl) {
  const response = await fetch("/api/profile-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName, contentType, dataUrl }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "\uD504\uB85C\uD544 \uC0AC\uC9C4\uC744 Blob \uC800\uC7A5\uC18C\uC5D0 \uC5C5\uB85C\uB4DC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
  return payload.url;
}

async function saveSheetState() {
  state.isSavingRemote = true;
  try {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accounts: state.accounts, assignments: state.assignments, raidPlans: state.raidPlans, albumImages: state.albumImages, memoNotes: state.memoNotes }),
    });
    state.isRemoteReady = response.ok;
    await updateRemoteVersionFromResponse(response);
    return response.ok;
  } catch {
    state.isRemoteReady = false;
    return false;
  } finally {
    state.isSavingRemote = false;
  }
}

async function saveRaidPlansState() {
  state.isSavingRemote = true;
  try {
    const response = await fetch("/api/state", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raidPlans: state.raidPlans }),
    });
    state.isRemoteReady = response.ok;
    await updateRemoteVersionFromResponse(response);
    return response.ok;
  } catch {
    state.isRemoteReady = false;
    return false;
  } finally {
    state.isSavingRemote = false;
  }
}

function applyRemoteSheetState(payload, options = {}) {
  const remoteAccounts = normalizeAccounts(payload.accounts);
  const remoteAssignments = normalizeAssignments(payload.assignments);
  const remoteRaidPlans = normalizeRaidPlans(payload.raidPlans);
  const remoteAlbumImages = normalizeAlbumImages(payload.albumImages);
  const remoteMemoNotes = normalizeMemoNotes(payload.memoNotes);
  const nextAccounts = remoteAccounts.length ? mergeAccountLists(remoteAccounts, state.accounts) : state.accounts;
  state.accounts = mergeDefaultAvatars(nextAccounts);
  if (Array.isArray(payload.assignments)) state.assignments = remoteAssignments;
  if (Array.isArray(payload.raidPlans)) state.raidPlans = remoteRaidPlans;
  if (Array.isArray(payload.albumImages)) state.albumImages = remoteAlbumImages;
  if (Array.isArray(payload.memoNotes)) state.memoNotes = remoteMemoNotes;
  if (options.resetDrafts) state.raidPlanDrafts = [];
  saveAccounts();
  saveAssignments();
  saveRaidPlans();
  saveAlbumImages();
  saveMemoNotes();
}

function startRemoteSync() {
  if (remoteSyncTimer) window.clearInterval(remoteSyncTimer);
  remoteSyncTimer = null;
  if (!document.hidden) {
    remoteSyncTimer = window.setInterval(syncRemoteStateIfChanged, remoteSyncIntervalMs);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (remoteSyncTimer) window.clearInterval(remoteSyncTimer);
      remoteSyncTimer = null;
      return;
    }

    syncRemoteStateIfChanged();
    if (!remoteSyncTimer) {
      remoteSyncTimer = window.setInterval(syncRemoteStateIfChanged, remoteSyncIntervalMs);
    }
  });
}

function hasLocalRaidWorkInProgress() {
  return state.editingRaidPlanIds.size > 0 || state.raidPlanDrafts.length > 0 || Boolean(state.raidPlanEditBackup);
}

async function syncRemoteStateIfChanged() {
  if (document.hidden || state.isSavingRemote || hasLocalRaidWorkInProgress()) return;
  try {
    const versionResponse = await fetch("/api/state?scope=raid-plans&version=1", { cache: "no-store" });
    if (!versionResponse.ok) throw new Error("remote state unavailable");
    const versionPayload = await versionResponse.json();
    state.isRemoteReady = true;
    const remoteUpdatedAt = versionPayload.updatedAt ?? null;
    if (!remoteUpdatedAt || remoteUpdatedAt === state.lastRemoteUpdatedAt) return;

    const response = await fetch("/api/state?scope=raid-plans", { cache: "no-store" });
    if (!response.ok) throw new Error("remote state unavailable");
    const payload = await response.json();
    applyRemoteSheetState(payload, { resetDrafts: false });
    state.lastRemoteUpdatedAt = payload.updatedAt ?? remoteUpdatedAt;
    renderAll();
    setStatus("다른 사용자의 변경사항을 반영했습니다.", "success");
  } catch {
    state.isRemoteReady = false;
  }
}

async function updateRemoteVersionFromResponse(response) {
  if (!response.ok) return;
  try {
    const payload = await response.clone().json();
    if (payload.updatedAt) state.lastRemoteUpdatedAt = payload.updatedAt;
  } catch {
    await syncRemoteStateIfChanged();
  }
}

function showSavingOverlay(message = "저장중...") {
  elements.savingOverlay.querySelector(".saving-panel").textContent = message;
  if (typeof elements.savingOverlay.showModal === "function" && !elements.savingOverlay.open) {
    elements.savingOverlay.showModal();
    return;
  }
  elements.savingOverlay.hidden = false;
}

function hideSavingOverlay() {
  if (typeof elements.savingOverlay.close === "function" && elements.savingOverlay.open) {
    elements.savingOverlay.close();
    return;
  }
  elements.savingOverlay.hidden = true;
}

function showSiteToast(message) {
  if (!elements.siteToast) return;

  const panel = elements.siteToast.querySelector(".site-toast-panel");
  if (panel) panel.textContent = message;

  elements.siteToast.hidden = false;
  elements.siteToast.classList.add("is-visible");

  if (siteToastTimer) window.clearTimeout(siteToastTimer);
  siteToastTimer = window.setTimeout(() => {
    elements.siteToast.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!elements.siteToast.classList.contains("is-visible")) {
        elements.siteToast.hidden = true;
      }
    }, 180);
  }, 3200);
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
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

function normalizeAlbumImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map((image, index) => {
    const url = String(image?.url ?? "");
    if (!url) return null;
    return {
      id: String(image?.id ?? `album-${index}`),
      name: String(image?.name ?? ""),
      url,
    };
  }).filter(Boolean).slice(0, maxAlbumImages);
}

function normalizeMemoNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.map((note, index) => {
    const author = String(note?.author ?? "").trim();
    const content = String(note?.content ?? "").trim();
    if (!author || !content) return null;
    return {
      id: String(note?.id ?? `memo-${index}`),
      author,
      content,
      createdAt: String(note?.createdAt ?? new Date().toISOString()),
    };
  }).filter(Boolean);
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
