// 상수, 상태, DOM 요소, 이벤트 연결, 초기 로딩
const minItemLevel = 1700;
const maxAlbumImages = 14;
const albumGridSlots = maxAlbumImages + 1;
const remoteSyncIntervalMs = 60_000;
let missingPaneResizeObserver = null;
let auctionPartySize = 8;
let remoteSyncTimer = null;
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
    if (options.refresh && assignmentsUpdated && state.isRemoteReady) saveSheetState();
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

