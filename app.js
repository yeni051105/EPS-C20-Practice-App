(function () {
  const allQuestions = window.EPS20_QUESTIONS || [];
  const state = {
    pool: [],
    index: 0,
    selected: null,
    answered: new Map(),
    shuffle: true,
    examMode: false,
  };

  const els = {
    setFilter: document.querySelector("#setFilter"),
    sourceFilter: document.querySelector("#sourceFilter"),
    topicFilter: document.querySelector("#topicFilter"),
    shuffleToggle: document.querySelector("#shuffleToggle"),
    examToggle: document.querySelector("#examToggle"),
    startButton: document.querySelector("#startButton"),
    missedButton: document.querySelector("#missedButton"),
    resetButton: document.querySelector("#resetButton"),
    statTotal: document.querySelector("#statTotal"),
    statAnswered: document.querySelector("#statAnswered"),
    statScore: document.querySelector("#statScore"),
    questionMeta: document.querySelector("#questionMeta"),
    questionCount: document.querySelector("#questionCount"),
    questionText: document.querySelector("#questionText"),
    choices: document.querySelector("#choices"),
    feedback: document.querySelector("#feedback"),
    prevButton: document.querySelector("#prevButton"),
    checkButton: document.querySelector("#checkButton"),
    nextButton: document.querySelector("#nextButton"),
    navigator: document.querySelector("#navigator"),
    progressFill: document.querySelector("#progressFill"),
  };

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  function filteredBase() {
    const set = els.setFilter.value;
    return allQuestions.filter((q) => set === "all" || q.set === set);
  }

  function populateSelect(select, values, allLabel) {
    const current = select.value;
    select.innerHTML = "";
    select.append(new Option(allLabel, "all"));
    values.forEach((value) => select.append(new Option(value, value)));
    if ([...select.options].some((option) => option.value === current)) {
      select.value = current;
    }
  }

  function refreshFilters() {
    const base = filteredBase();
    populateSelect(els.sourceFilter, uniqueSorted(base.map((q) => q.source)), "All lectures / sources");
    const source = els.sourceFilter.value;
    const topicBase = base.filter((q) => source === "all" || q.source === source);
    populateSelect(els.topicFilter, uniqueSorted(topicBase.map((q) => q.topic)), "All topics");
    updateAvailableCount();
  }

  function getFilteredQuestions() {
    const set = els.setFilter.value;
    const source = els.sourceFilter.value;
    const topic = els.topicFilter.value;
    return allQuestions.filter((q) => {
      return (set === "all" || q.set === set) &&
        (source === "all" || q.source === source) &&
        (topic === "all" || q.topic === topic);
    });
  }

  function shuffle(items) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function setToggle(button, value) {
    button.setAttribute("aria-pressed", String(value));
  }

  function saveSession() {
    const data = {
      poolIds: state.pool.map((q) => q.id),
      index: state.index,
      answered: [...state.answered.entries()],
      shuffle: state.shuffle,
      examMode: state.examMode,
    };
    localStorage.setItem("eps20PracticeSession", JSON.stringify(data));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem("eps20PracticeSession");
      if (!raw) return false;
      const data = JSON.parse(raw);
      const byId = new Map(allQuestions.map((q) => [q.id, q]));
      state.pool = data.poolIds.map((id) => byId.get(id)).filter(Boolean);
      state.index = Math.min(data.index || 0, Math.max(state.pool.length - 1, 0));
      state.answered = new Map(data.answered || []);
      state.shuffle = data.shuffle !== false;
      state.examMode = data.examMode === true;
      setToggle(els.shuffleToggle, state.shuffle);
      setToggle(els.examToggle, state.examMode);
      return state.pool.length > 0;
    } catch {
      return false;
    }
  }

  function updateAvailableCount() {
    els.statTotal.textContent = getFilteredQuestions().length;
  }

  function startPractice(questions) {
    const base = questions || getFilteredQuestions();
    state.pool = state.shuffle ? shuffle(base) : [...base];
    state.index = 0;
    state.selected = null;
    state.answered = new Map();
    render();
    saveSession();
  }

  function currentQuestion() {
    return state.pool[state.index];
  }

  function answerFor(id) {
    return state.answered.get(id);
  }

  function answeredStats() {
    const entries = [...state.answered.values()];
    const correct = entries.filter((entry) => entry.correct).length;
    return { answered: entries.length, correct };
  }

  function render() {
    const q = currentQuestion();
    const stats = answeredStats();
    els.statTotal.textContent = state.pool.length || getFilteredQuestions().length;
    els.statAnswered.textContent = stats.answered;
    els.statScore.textContent = stats.answered ? `${Math.round((stats.correct / stats.answered) * 100)}%` : "0%";
    els.progressFill.style.width = state.pool.length ? `${((state.index + 1) / state.pool.length) * 100}%` : "0%";

    if (!q) {
      els.questionMeta.textContent = "Ready";
      els.questionCount.textContent = "Choose a set to begin";
      els.questionText.textContent = "Select filters, then start a practice session.";
      els.choices.innerHTML = "";
      els.feedback.hidden = true;
      els.prevButton.disabled = true;
      els.nextButton.disabled = true;
      els.checkButton.disabled = true;
      renderNavigator();
      return;
    }

    const saved = answerFor(q.id);
    state.selected = saved ? saved.selected : null;
    els.questionMeta.textContent = `${q.set} / ${q.source} / ${q.topic}`;
    els.questionCount.textContent = `Question ${state.index + 1} of ${state.pool.length}`;
    els.questionText.textContent = q.question;
    renderChoices(q, saved);
    renderFeedback(q, saved);
    els.prevButton.disabled = state.index === 0;
    els.nextButton.disabled = state.index >= state.pool.length - 1;
    els.checkButton.disabled = !state.selected || Boolean(saved);
    renderNavigator();
  }

  function renderChoices(q, saved) {
    els.choices.innerHTML = "";
    q.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.dataset.letter = choice.letter;
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = choice.letter;
      const text = document.createElement("span");
      text.textContent = choice.text;
      button.append(letter, text);

      if (choice.letter === state.selected) button.classList.add("selected");
      if (saved && !state.examMode && choice.letter === q.answer) button.classList.add("correct");
      if (saved && !saved.correct && choice.letter === saved.selected) button.classList.add("wrong");
      if (saved) button.disabled = true;

      button.addEventListener("click", () => {
        state.selected = choice.letter;
        els.checkButton.disabled = false;
        renderChoices(q, saved);
      });
      els.choices.append(button);
    });
  }

  function renderFeedback(q, saved) {
    if (!saved || state.examMode) {
      els.feedback.hidden = true;
      els.feedback.innerHTML = "";
      return;
    }
    els.feedback.hidden = false;
    const label = saved.correct ? "Correct" : `Not quite. Answer: ${q.answerRaw || q.answer}`;
    els.feedback.innerHTML = `<strong>${escapeHtml(label)}</strong>${escapeHtml(q.explanation)}`;
  }

  function renderNavigator() {
    els.navigator.innerHTML = "";
    state.pool.forEach((q, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-dot";
      button.textContent = String(index + 1);
      const saved = answerFor(q.id);
      if (index === state.index) button.classList.add("current");
      if (saved) button.classList.add(saved.correct ? "good" : "bad");
      button.addEventListener("click", () => {
        state.index = index;
        state.selected = null;
        render();
        saveSession();
      });
      els.navigator.append(button);
    });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function checkAnswer() {
    const q = currentQuestion();
    if (!q || !state.selected) return;
    state.answered.set(q.id, {
      selected: state.selected,
      correct: state.selected === q.answer,
    });
    render();
    saveSession();
  }

  function move(delta) {
    if (!state.pool.length) return;
    state.index = Math.max(0, Math.min(state.pool.length - 1, state.index + delta));
    state.selected = null;
    render();
    saveSession();
  }

  els.setFilter.addEventListener("change", refreshFilters);
  els.sourceFilter.addEventListener("change", () => {
    const base = filteredBase();
    const source = els.sourceFilter.value;
    const topicBase = base.filter((q) => source === "all" || q.source === source);
    populateSelect(els.topicFilter, uniqueSorted(topicBase.map((q) => q.topic)), "All topics");
    updateAvailableCount();
  });
  els.topicFilter.addEventListener("change", updateAvailableCount);
  els.shuffleToggle.addEventListener("click", () => {
    state.shuffle = !state.shuffle;
    setToggle(els.shuffleToggle, state.shuffle);
    saveSession();
  });
  els.examToggle.addEventListener("click", () => {
    state.examMode = !state.examMode;
    setToggle(els.examToggle, state.examMode);
    render();
    saveSession();
  });
  els.startButton.addEventListener("click", () => startPractice());
  els.checkButton.addEventListener("click", checkAnswer);
  els.prevButton.addEventListener("click", () => move(-1));
  els.nextButton.addEventListener("click", () => move(1));
  els.resetButton.addEventListener("click", () => {
    localStorage.removeItem("eps20PracticeSession");
    state.pool = [];
    state.index = 0;
    state.selected = null;
    state.answered = new Map();
    render();
  });
  els.missedButton.addEventListener("click", () => {
    const missed = state.pool.filter((q) => {
      const saved = answerFor(q.id);
      return saved && !saved.correct;
    });
    if (missed.length) startPractice(missed);
  });

  refreshFilters();
  if (loadSession()) {
    render();
  } else {
    render();
  }
})();
