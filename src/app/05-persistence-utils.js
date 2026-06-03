// 원격/로컬 저장소, 정규화, 공용 유틸리티
async function loadSheetState() {
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("remote state unavailable");
    const payload = await response.json();
    applyRemoteSheetState(payload, { resetDrafts: true });
    state.isRemoteReady = true;
    state.lastRemoteUpdatedAt = payload.updatedAt ?? null;
    renderAll();
    if (!payload.exists) saveSheetState();
  } catch {
    state.isRemoteReady = false;
    renderAll();
  }
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
  remoteSyncTimer = window.setInterval(syncRemoteStateIfChanged, remoteSyncIntervalMs);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncRemoteStateIfChanged();
  });
}

function hasLocalRaidWorkInProgress() {
  return state.editingRaidPlanIds.size > 0 || state.raidPlanDrafts.length > 0 || Boolean(state.raidPlanEditBackup);
}

async function syncRemoteStateIfChanged() {
  if (document.hidden || state.isSavingRemote || hasLocalRaidWorkInProgress()) return;
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("remote state unavailable");
    const payload = await response.json();
    state.isRemoteReady = true;
    const remoteUpdatedAt = payload.updatedAt ?? null;
    if (!remoteUpdatedAt || remoteUpdatedAt === state.lastRemoteUpdatedAt) return;
    applyRemoteSheetState(payload, { resetDrafts: false });
    state.lastRemoteUpdatedAt = remoteUpdatedAt;
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
