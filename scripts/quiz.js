// --------- Helpers ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
	const j = Math.floor(Math.random() * (i + 1));
	[arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeNewlines(s) {
  return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseQuizText(text) {
  const t = normalizeNewlines(text).trim();
  if (!t) return [];

  const blocks = t.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  const questions = [];

  for (const block of blocks) {
	const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
	if (lines.length < 2) continue;

	const qLine = lines[0];
	const qMatch = qLine.match(/^\s*\d+\.\s*(.+)$/);
	const question = (qMatch ? qMatch[1] : qLine).trim();

	const options = [];
	for (let i = 1; i < lines.length; i++) {
	  const line = lines[i];
	  const m = line.match(/^([a-zA-Z])\)\s*(.+)$/);
	  if (!m) continue;

	  const letterRaw = m[1];
	  const letter = letterRaw.toUpperCase();
	  const isCorrect = (letterRaw === letterRaw.toUpperCase());
	  const label = m[2].trim();

	  options.push({ letter, label, isCorrect });
	}

	if (question && options.length > 0) {
	  questions.push({ question, options });
	}
  }
  return questions;
}

// --------- State ----------
// IMPORTANT: Start (fișier) pornește DOAR întrebările încărcate din fișier.
// Demo-ul rulează separat și NU afectează butonul Start.
let loadedQuestions = []; // din fișier
let queue = [];
let current = null;

let stats = { correct: 0, wrong: 0, answered: 0 };

// --------- Preset (GitHub) files ----------
// IMPORTANT: folosește link-uri RAW (raw.githubusercontent.com) sau link direct către fișierul servit de GitHub Pages.
// Exemplu RAW:
// https://raw.githubusercontent.com/USERNAME/REPO/main/path/capitol1.txt
const PRESET_FILES = [
  { name: "variantele C si D", url: "https://geckoro.github.io/quiz_questions/variantele%20c%20si%20d.txt" },
];


// Counter: "Întrebarea curentă / total"
let totalQuestions = 0;
let currentIndex = 0;

// --------- UI refs ----------
const fileInput = document.getElementById("fileInput");
const startBtn = document.getElementById("startBtn");
const loadDemoBtn = document.getElementById("loadDemo");
const resetBtn = document.getElementById("resetBtn");
const endBtn = document.getElementById("endBtn");

const quizCard = document.getElementById("quizCard");
const questionText = document.getElementById("questionText");
const answersEl = document.getElementById("answers");

const checkBtn = document.getElementById("checkBtn");
const nextBtn = document.getElementById("nextBtn");
const feedbackEl = document.getElementById("feedback");

const remainingEl = document.getElementById("remaining");
const correctEl = document.getElementById("correct");
const wrongEl = document.getElementById("wrong");

const qIndexEl = document.getElementById("qIndex");
const qTotalEl = document.getElementById("qTotal");


// --------- Preset (GitHub) UI refs ----------
const presetSelect = document.getElementById("presetSelect");
const presetButtons = document.getElementById("presetButtons");
const loadPresetBtn = document.getElementById("loadPresetBtn");
const startPresetBtn = document.getElementById("startPresetBtn");
const presetStatus = document.getElementById("presetStatus");


// --------- UI functions ----------
function updateStatsUI() {
  correctEl.textContent = String(stats.correct);
  wrongEl.textContent = String(stats.wrong);
  remainingEl.textContent = String(queue.length);

  qTotalEl.textContent = String(totalQuestions);
  qIndexEl.textContent = String(current ? currentIndex : (totalQuestions || 0));
}


// --------- Preset (GitHub) loaders ----------
function setPresetStatus(msg) {
  if (!presetStatus) return;
  presetStatus.textContent = msg || "";
}

async function loadQuestionsFromUrl(url, { autoStart = false } = {}) {
  try {
    setPresetStatus("Se încarcă...");
    if (loadPresetBtn) loadPresetBtn.disabled = true;
    if (startPresetBtn) startPresetBtn.disabled = true;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    loadQuestionsFromFileText(text);

    if (loadedQuestions.length > 0) {
      setPresetStatus(`Încărcat: ${loadedQuestions.length} întrebări.`);
      if (startPresetBtn) startPresetBtn.disabled = false;
      if (autoStart) startQuiz(loadedQuestions);
    } else {
      setPresetStatus("Nu s-au găsit întrebări valide în fișier.");
    }
  } catch (err) {
    console.error(err);
    setPresetStatus("Eroare la încărcarea fișierului preset.");
    alert("Eroare la încărcarea fișierului preset (verifică URL-ul RAW și că fișierul există).");
  } finally {
    if (presetSelect && loadPresetBtn) loadPresetBtn.disabled = !presetSelect.value;
  }
}

function initPresetUI() {
  // Dacă elementele nu există (de ex. rulezi un HTML vechi), ieșim fără să stricăm pagina
  if (!presetSelect || !presetButtons || !loadPresetBtn || !startPresetBtn) return;

  // Populează combobox
  PRESET_FILES.forEach((f, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = f.name;
    presetSelect.appendChild(opt);
  });

  presetSelect.addEventListener("change", () => {
    loadPresetBtn.disabled = !presetSelect.value;
    startPresetBtn.disabled = true;
    setPresetStatus("");
  });

  loadPresetBtn.addEventListener("click", async () => {
    const idx = Number(presetSelect.value);
    const f = PRESET_FILES[idx];
    if (!f) return;
    await loadQuestionsFromUrl(f.url, { autoStart: false });
  });

  startPresetBtn.addEventListener("click", () => {
    if (loadedQuestions.length === 0) return;
    startQuiz(loadedQuestions);
  });

  // Butoane dedicate: click = încarcă și pornește direct
  presetButtons.innerHTML = "";

  loadPresetBtn.disabled = true;
  startPresetBtn.disabled = true;
}

function setFeedback(type, html) {
  feedbackEl.style.display = "block";
  feedbackEl.classList.remove("good", "bad");
  if (type === "good") feedbackEl.classList.add("good");
  if (type === "bad") feedbackEl.classList.add("bad");
  feedbackEl.innerHTML = html;
}

function clearFeedback() {
  feedbackEl.style.display = "none";
  feedbackEl.classList.remove("good", "bad");
  feedbackEl.innerHTML = "";
}

function renderQuestion(q) {
  current = q;

  clearFeedback();
  nextBtn.disabled = true;

  questionText.textContent = q.question;
  answersEl.innerHTML = "";

  const correctCount = q.options.filter(o => o.isCorrect).length;

  q.options.forEach((opt, idx) => {
	const id = `opt_${idx}_${opt.letter}_${Math.random().toString(16).slice(2)}`;

	const label = document.createElement("label");
	label.className = "opt";
	label.htmlFor = id;

	const checkbox = document.createElement("input");
	checkbox.type = "checkbox";
	checkbox.id = id;
	checkbox.dataset.letter = opt.letter;

	checkbox.addEventListener("change", () => {
	  checkBtn.disabled = false;
	});

	const badge = document.createElement("div");
	badge.className = "letter";
	badge.textContent = opt.letter;

	const text = document.createElement("div");
	text.innerHTML = `<div>${opt.label}</div>`;

	label.appendChild(checkbox);
	label.appendChild(badge);
	label.appendChild(text);

	answersEl.appendChild(label);
  });

  checkBtn.disabled = false;
  updateStatsUI();
}

function getSelectedLetters() {
  return [...answersEl.querySelectorAll('input[type="checkbox"]')]
	.filter(x => x.checked)
	.map(x => x.dataset.letter)
	.sort();
}

function getCorrectLetters(q) {
  return q.options.filter(o => o.isCorrect).map(o => o.letter).sort();
}

function sameArray(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function disableInputs() {
  [...answersEl.querySelectorAll('input[type="checkbox"]')].forEach(x => x.disabled = true);
}

function finishQuiz() {
  current = null;

  quizCard.style.display = "block";
  questionText.textContent = "Gata! Ai terminat toate întrebările.";
  answersEl.innerHTML = "";
  checkBtn.disabled = true;
  nextBtn.disabled = true;

  const total = stats.correct + stats.wrong;
  const pct = total ? Math.round((stats.correct / total) * 100) : 0;

  setFeedback("good", `<b>Rezultat:</b> ${stats.correct} corecte, ${stats.wrong} greșite (${pct}%).`);

  endBtn.disabled = true;
  updateStatsUI();
}

function nextQuestionOrEnd() {
  if (queue.length === 0) {
	finishQuiz();
	return;
  }

  const q = queue.shift();
  currentIndex = totalQuestions - queue.length; // 1..N
  renderQuestion(q);
}

function startQuiz(questions) {
  // pornește cu un set de întrebări DAT (poate fi demo sau fișier)
  queue = shuffle(questions.slice());

  totalQuestions = questions.length;
  currentIndex = 0;
  current = null;

  stats = { correct: 0, wrong: 0, answered: 0 };

  quizCard.style.display = "block";
  resetBtn.disabled = false;
  endBtn.disabled = false;
  nextBtn.disabled = true;
  checkBtn.disabled = false;

  nextQuestionOrEnd();
  updateStatsUI();
}

function loadQuestionsFromFileText(text) {
  const q = parseQuizText(text);

  if (q.length === 0) {
	loadedQuestions = [];
	startBtn.disabled = true;
	alert("Nu am găsit întrebări valide în fișier. Verifică formatul (linii goale între întrebări, opțiuni a) / B) etc.).");
	return;
  }

  loadedQuestions = q;
  startBtn.disabled = false;
}

// --------- Events ----------
fileInput.addEventListener("change", async (e) => {
  try {
	const f = e.target.files && e.target.files[0];
	if (!f) return;
	const text = await f.text();
	loadQuestionsFromFileText(text);
  } catch (err) {
	console.error(err);
	alert("Eroare la citirea fișierului.");
  }
});

// DEMO: rulează separat, NU afectează loadedQuestions și NU "armează" butonul Start
loadDemoBtn.addEventListener("click", () => {
  const demo = `1. Care sunt numere prime?
a) 4
B) 5
C) 7
d) 9

2. Alege toate afirmațiile adevărate:
A) Apa fierbe la ~100°C la presiune atmosferică.
b) Soarele se învârte în jurul Pământului.
C) București e în România.

3. Întrebare fără răspuns corect:
a) Verde
b) Albastru
c) Roșu
`;
  const demoQuestions = parseQuizText(demo);
  if (demoQuestions.length === 0) {
	alert("Demo-ul nu a putut fi parsat (0 întrebări).");
	return;
  }
  startQuiz(demoQuestions);
});

// Start: pornește DOAR întrebările din fișier
startBtn.addEventListener("click", () => {
  if (loadedQuestions.length === 0) return;
  startQuiz(loadedQuestions);
});

resetBtn.addEventListener("click", () => {
  // reset = repornește ultimul set (cel curent). Pentru simplitate, repornim cu ce e în coadă+curent nu e trivial,
  // așa că repornim cu loadedQuestions dacă există; altfel nu facem nimic.
  if (loadedQuestions.length > 0) startQuiz(loadedQuestions);
});

endBtn.addEventListener("click", () => {
  queue = [];
  finishQuiz();
});

checkBtn.addEventListener("click", () => {
  if (!current) return;

  const selected = getSelectedLetters();
  const correct = getCorrectLetters(current);

  disableInputs();

  const ok = sameArray(selected, correct);
  stats.answered += 1;

  if (ok) stats.correct += 1;
  else stats.wrong += 1;

  const niceSelected = selected.length ? selected.join(", ") : "— (nimic)";
  const niceCorrect = correct.length ? correct.join(", ") : "— (niciun răspuns corect)";

  setFeedback(ok ? "good" : "bad",
	`<div><b>${ok ? "Corect ✅" : "Greșit ❌"}</b></div>
	 <div class="small">Tu: <span class="mono">${niceSelected}</span></div>
	 <div class="small">Corect: <span class="mono">${niceCorrect}</span></div>`
  );

  checkBtn.disabled = true;
  nextBtn.disabled = false;
  updateStatsUI();
});

nextBtn.addEventListener("click", () => {
  nextQuestionOrEnd();
});

// Init UI
updateStatsUI();
initPresetUI();