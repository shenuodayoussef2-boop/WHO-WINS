
const $ = (selector) => document.querySelector(selector);

const translations = {
  en: {
    navArena: "Arena", navCreate: "Create",
    eyebrow: "THE INTERNET DECIDES",
    heroTitle: "ONE QUESTION.<br><span>TWO LEGENDS.</span>",
    heroText: "Create the ultimate showdown. Let people vote. Discover who really wins.",
    explore: "EXPLORE BATTLES ↗",
    statBattles: "BATTLES", statVotes: "VOTES CAST", statChoices: "CHOICES",
    createEyebrow: "YOUR IDEA. YOUR BATTLE.",
    createTitle: "Start a showdown.",
    questionLabel: "WHAT ARE WE DECIDING?",
    optionA: "OPTION A", optionB: "OPTION B",
    createButton: "CREATE YOUR BATTLE →",
    arenaEyebrow: "THE COMMUNITY DECIDES",
    arenaTitle: "Enter the arena.", refresh: "Refresh",
    latest: "LATEST BATTLES", loading: "Loading battles...",
    emptyTitle: "The arena is waiting.",
    emptyText: "Be the first to create a battle.",
    emptyLink: "CREATE THE FIRST BATTLE ↗",
    footerText: "Built for opinions. Powered by people.",
    questionPlaceholder: "Messi vs Ronaldo?",
    optionOnePlaceholder: "MESSI", optionTwoPlaceholder: "RONALDO",
    battle: "BATTLE", votes: "votes", vote: "Vote",
    voted: "Voted", share: "Share", noVotes: "No votes yet",
    choose: "Choose your champion",
    created: "Battle created successfully!",
    voteSuccess: "Your vote has been counted!",
    alreadyVoted: "You have already voted in this battle.",
    loadError: "Couldn't load battles. Check your server.",
    createError: "Couldn't create the battle.",
    voteError: "Couldn't register your vote.",
    fillFields: "Please fill in all three fields.",
    sameOptions: "Choose two different options.",
    copied: "Battle link copied!",
    shareError: "Couldn't share this battle.",
    count: "battles"
  },
  ar: {
    navArena: "المواجهات", navCreate: "إنشاء مواجهة",
    eyebrow: "الإنترنت هو الحكم",
    heroTitle: "سؤال واحد.<br><span>أسطورتان.</span>",
    heroText: "اعمل مواجهة قوية، وخلي الناس تصوّت، واكتشف مين الفائز الحقيقي.",
    explore: "اكتشف المواجهات ↗",
    statBattles: "مواجهة", statVotes: "تصويت", statChoices: "اختيارات",
    createEyebrow: "فكرتك. مواجهتك.",
    createTitle: "ابدأ المواجهة.",
    questionLabel: "إيه السؤال اللي هنحسمه؟",
    optionA: "الاختيار الأول", optionB: "الاختيار الثاني",
    createButton: "أنشئ المواجهة ←",
    arenaEyebrow: "المجتمع هو الحكم",
    arenaTitle: "ادخل ساحة المواجهات.", refresh: "تحديث",
    latest: "أحدث المواجهات", loading: "جاري تحميل المواجهات...",
    emptyTitle: "الساحة مستنياك!",
    emptyText: "كن أول شخص ينشئ مواجهة.",
    emptyLink: "أنشئ أول مواجهة ↗",
    footerText: "آراؤكم تصنع المنافسة.",
    questionPlaceholder: "ميسي ولا رونالدو؟",
    optionOnePlaceholder: "ميسي", optionTwoPlaceholder: "رونالدو",
    battle: "مواجهة", votes: "صوت", vote: "صوّت",
    voted: "صوّتَّ", share: "مشاركة", noVotes: "لسه مفيش أصوات",
    choose: "اختار الفائز",
    created: "تم إنشاء المواجهة بنجاح!",
    voteSuccess: "تم تسجيل صوتك!",
    alreadyVoted: "أنت صوّتَّ في المواجهة دي قبل كده.",
    loadError: "تعذر تحميل المواجهات. تأكد من تشغيل السيرفر.",
    createError: "تعذر إنشاء المواجهة.",
    voteError: "تعذر تسجيل التصويت.",
    fillFields: "اكتب السؤال والاختيارين.",
    sameOptions: "اختار حاجتين مختلفتين.",
    copied: "تم نسخ رابط المواجهة!",
    shareError: "تعذرت مشاركة المواجهة.",
    count: "مواجهة"
  }
};

let language = localStorage.getItem("ww-language") || "en";
let toastTimer;
let polls = [];
let loading = false;

function t(key) {
  return translations[language][key] || translations.en[key] || key;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getVoterId() {
  let id = localStorage.getItem("ww-voter-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ww-voter-id", id);
  }
  return id;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `message ${type}`.trim();
}

function applyLanguage() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  $("#languageBtn").textContent = language === "ar" ? "English" : "العربية";

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (translations[language][key]) {
      element.innerHTML = translations[language][key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (translations[language][key]) {
      element.placeholder = translations[language][key];
    }
  });

  renderPolls();
}

function optionLabel(option) {
  return language === "ar"
    ? (option.labelAr || option.label)
    : (option.label || option.labelAr);
}

function pollQuestion(poll) {
  return language === "ar"
    ? (poll.questionAr || poll.question)
    : (poll.question || poll.questionAr);
}

function renderPolls() {
  const grid = $("#pollGrid");
  const empty = $("#emptyState");

  $("#battleCount").textContent = polls.length;
  $("#voteCount").textContent = polls.reduce(
    (sum, poll) => sum + Number(poll.totalVotes || 0), 0
  );
  $("#resultsCount").textContent =
    `${polls.length} ${t("count")}`;

  if (!polls.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  grid.innerHTML = polls.map((poll) => {
    const total = Number(poll.totalVotes || 0);
    const voted = Boolean(poll.hasVoted);

    const options = poll.options.map((option, index) => {
      const count = Number(option.votes || 0);
      const percent = total ? Math.round(count * 100 / total) : 0;
      const selected = poll.votedOptionId === option.id;
      const resultText = voted
        ? `${percent}% · ${count} ${t("votes")}`
        : (total ? `${count} ${t("votes")}` : t("vote"));

      return `
        <button
          class="vote-btn ${selected ? "selected" : ""}"
          type="button"
          data-poll-id="${escapeHTML(poll.id)}"
          data-option-id="${escapeHTML(option.id)}"
          ${voted ? "disabled" : ""}
          aria-label="${escapeHTML(t("vote") + " " + optionLabel(option))}"
        >
          <span class="option-name">${escapeHTML(optionLabel(option))}</span>
          <span class="option-result">${escapeHTML(resultText)}</span>
          <span class="bar-fill" style="width:${voted ? percent : 0}%"></span>
        </button>`;
    }).join("");

    return `
      <article class="poll-card" id="poll-${escapeHTML(poll.id)}">
        <div class="poll-top">
          <span class="poll-tag">${escapeHTML(t("battle"))} / ${escapeHTML(poll.id)}</span>
          <button class="poll-share" type="button" data-share-id="${escapeHTML(poll.id)}">
            ↗ ${escapeHTML(t("share"))}
          </button>
        </div>
        <h3 class="poll-question">${escapeHTML(pollQuestion(poll))}</h3>
        <div class="poll-options">${options}</div>
        <div class="poll-footer">
          <span>${total ? `${total} ${escapeHTML(t("votes"))}` : escapeHTML(t("noVotes"))}</span>
          <strong>${voted ? escapeHTML(t("voted")) : escapeHTML(t("choose"))}</strong>
        </div>
      </article>`;
  }).join("");
}

async function loadPolls() {
  if (loading) return;
  loading = true;
  $("#refreshBtn").disabled = true;
  $("#arenaMessage").textContent = "";

  try {
    const result = await api(
      `/api/polls?voterId=${encodeURIComponent(getVoterId())}`
    );
    polls = result.polls || [];
    renderPolls();

    const hash = window.location.hash;
    if (hash.startsWith("#poll-")) {
      requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      });
    }
  } catch (error) {
    $("#arenaMessage").textContent = t("loadError");
    if (!polls.length) {
      $("#pollGrid").innerHTML = "";
      $("#emptyState").hidden = true;
    }
  } finally {
    loading = false;
    $("#refreshBtn").disabled = false;
  }
}

$("#languageBtn").addEventListener("click", () => {
  language = language === "en" ? "ar" : "en";
  localStorage.setItem("ww-language", language);
  applyLanguage();
});

$("#refreshBtn").addEventListener("click", loadPolls);

$("#createForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = $("#question").value.trim();
  const optionOne = $("#optionOne").value.trim();
  const optionTwo = $("#optionTwo").value.trim();
  const button = event.currentTarget.querySelector('button[type="submit"]');

  if (!question || !optionOne || !optionTwo) {
    setMessage($("#formMessage"), t("fillFields"), "error");
    return;
  }

  if (optionOne.toLocaleLowerCase() === optionTwo.toLocaleLowerCase()) {
    setMessage($("#formMessage"), t("sameOptions"), "error");
    return;
  }

  button.disabled = true;
  setMessage($("#formMessage"), "");

  try {
    const result = await api("/api/polls", {
      method: "POST",
      body: JSON.stringify({
        question,
        questionAr: question,
        options: [optionOne, optionTwo],
        optionsAr: [optionOne, optionTwo],
        voterId: getVoterId()
      })
    });

    $("#createForm").reset();
    showToast(t("created"));
    await loadPolls();

    if (result.poll?.id) {
      window.location.hash = `poll-${result.poll.id}`;
    }
  } catch (error) {
    setMessage($("#formMessage"), t("createError"), "error");
  } finally {
    button.disabled = false;
  }
});

$("#pollGrid").addEventListener("click", async (event) => {
  const shareButton = event.target.closest("[data-share-id]");
  if (shareButton) {
    await sharePoll(shareButton.dataset.shareId);
    return;
  }

  const voteButton = event.target.closest("[data-option-id]");
  if (!voteButton || voteButton.disabled) return;

  voteButton.disabled = true;

  try {
    await api(`/api/polls/${encodeURIComponent(voteButton.dataset.pollId)}/vote`, {
      method: "POST",
      body: JSON.stringify({
        optionId: voteButton.dataset.optionId,
        voterId: getVoterId()
      })
    });

    showToast(t("voteSuccess"));
    await loadPolls();
  } catch (error) {
    if (error.status === 409) {
      showToast(t("alreadyVoted"));
      await loadPolls();
    } else {
      showToast(t("voteError"));
      voteButton.disabled = false;
    }
  }
});

async function sharePoll(id) {
  const url = `${window.location.origin}${window.location.pathname}#poll-${encodeURIComponent(id)}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "WHO WINS?",
        text: language === "ar" ? "صوّت في المواجهة دي!" : "Vote in this showdown!",
        url
      });
    } else {
      await navigator.clipboard.writeText(url);
      showToast(t("copied"));
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      try {
        await navigator.clipboard.writeText(url);
        showToast(t("copied"));
      } catch {
        showToast(t("shareError"));
      }
    }
  }
}

$("#year").textContent = new Date().getFullYear();
applyLanguage();
loadPolls();

// Refresh results periodically while the page is open.
setInterval(loadPolls, 15000);