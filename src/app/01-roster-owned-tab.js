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

