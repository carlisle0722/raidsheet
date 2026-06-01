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
  if (file.size > 4 * 1024 * 1024) {
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
  return `${Math.max(0, Math.floor(value)).toLocaleString("ko-KR")} 🪙`;
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
  try {
    const response = await fetch("/api/album-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, dataUrl }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "앨범 사진 업로드에 실패했습니다.");
    return payload.url;
  } catch {
    return dataUrl;
  }
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

