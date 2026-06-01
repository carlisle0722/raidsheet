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
