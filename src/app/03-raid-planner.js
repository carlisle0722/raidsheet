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
      option.className = "is-danger-option";
      option.style.color = "var(--danger)";
    } else if (optionStatus.isExtra) {
      option.className = "is-extra-option";
      option.style.color = "var(--option-extra)";
    }
    select.add(option);
  }
  select.addEventListener("change", () => {
    showRaidSelectionWarning(plan, owner, select.value, raidPlans);
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
  const normalizedRaidName = normalizeRaidNameForColor(raidName);
  const extra = getExtraRaids(character);
  const sameRaidCount = getRaidPlanRows(raidPlans).filter((row) => {
    if (row.excluded || normalizeRaidNameForColor(row.raidName) !== normalizedRaidName) return false;
    return Object.values(row.characters ?? {}).includes(character.key);
  }).length;
  return {
    isExtra: raidListIncludes(extra, raidName),
    isExcluded: Boolean(plan.excluded) || !canJoinRaid(character, raidName),
    isDuplicate: sameRaidCount > 1,
  };
}

function getRaidCharacterOptionStatus(plan, character, raidPlans) {
  const raidName = plan.raidName?.trim();
  const normalizedRaidName = normalizeRaidNameForColor(raidName);
  const sameRaidCount = getRaidPlanRows(raidPlans).filter((row) => {
    if (row.id === plan.id || row.excluded || normalizeRaidNameForColor(row.raidName) !== normalizedRaidName) return false;
    return Object.values(row.characters ?? {}).includes(character.key);
  }).length;
  return {
    isDuplicate: sameRaidCount > 0,
    isExtra: raidListIncludes(getExtraRaids(character), raidName),
  };
}

function showRaidSelectionWarning(plan, owner, characterKey, raidPlans) {
  if (!characterKey) return;
  const character = findCharacterByKey(characterKey);
  if (!character) return;
  const nextPlan = { ...plan, characters: { ...(plan.characters ?? {}), [owner]: characterKey } };
  const optionStatus = getRaidCharacterOptionStatus(nextPlan, character, raidPlans);
  if (optionStatus.isDuplicate) {
    alert("이미 편성된 캐릭입니다.");
    return;
  }
  const cellStatus = getRaidPlanCellStatus(nextPlan, character, raidPlans);
  if (cellStatus.isExcluded) alert("현재 레이드와 레벨이 맞지 않습니다.");
}

function canJoinRaid(character, raidName) {
  if (!raidName) return true;
  const recommendation = getRaidRecommendation(character);
  return raidListIncludes(recommendation.primary, raidName) || raidListIncludes(recommendation.extra, raidName);
}

function raidListIncludes(raidNames, raidName) {
  const normalizedRaidName = normalizeRaidNameForColor(raidName);
  return raidNames.some((item) => normalizeRaidNameForColor(item) === normalizedRaidName);
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
