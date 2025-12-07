const API_BASE = "";

// ---------- SIMPLE SCREEN NAV ----------
const screens = document.querySelectorAll(".screen");
const navLinks = document.querySelectorAll(".nav-link");

function showScreen(id) {
    screens.forEach((s) => s.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");

    navLinks.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.screen === id);
    });

    if (id === "profile-screen") {
        loadProfile();
    } else if (id === "leaderboard-screen") {
        loadLeaderboard();
    }
}

navLinks.forEach((btn) => {
    btn.addEventListener("click", () => {
        const screenId = btn.dataset.screen;
        if (screenId) showScreen(screenId);
    });
});

document.querySelectorAll("[data-screen-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-screen-target");
        if (target) showScreen(target);
    });
});

// ---------- AUTH MODAL ----------
const authModal = document.getElementById("auth-modal");
const btnLogin = document.getElementById("btn-login");
const btnSignup = document.getElementById("btn-signup");
const authClose = document.getElementById("auth-close");

const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const loginForm = document.getElementById("auth-login-form");
const signupForm = document.getElementById("auth-signup-form");
const loginSubmit = document.getElementById("login-submit");
const signupSubmit = document.getElementById("signup-submit");

const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const signupUsernameInput = document.getElementById("signup-username");
const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");

let currentUser = null;
let authToken = null;

btnLogin.addEventListener("click", () => openAuthModal("login"));
btnSignup.addEventListener("click", () => openAuthModal("signup"));

authClose.addEventListener("click", () => {
    authModal.classList.add("hidden");
});

authModal.addEventListener("click", (e) => {
    if (e.target === authModal) {
        authModal.classList.add("hidden");
    }
});

tabLogin.addEventListener("click", () => switchAuthTab("login"));
tabSignup.addEventListener("click", () => switchAuthTab("signup"));

function openAuthModal(mode) {
    authModal.classList.remove("hidden");
    switchAuthTab(mode);
}

function switchAuthTab(mode) {
    const isLogin = mode === "login";
    tabLogin.classList.toggle("active", isLogin);
    tabSignup.classList.toggle("active", !isLogin);
    loginForm.classList.toggle("active", isLogin);
    signupForm.classList.toggle("active", !isLogin);
    loginError.textContent = "";
    signupError.textContent = "";
}

// ---------- AUTH API HELPERS ----------
function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }
    return headers;
}

async function signup() {
    signupError.textContent = "";
    try {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                username: signupUsernameInput.value.trim(),
                email: signupEmailInput.value.trim(),
                password: signupPasswordInput.value
            })
        });

        const data = await res.json();
        if (!res.ok) {
            signupError.textContent = data.error || "Signup failed";
            return;
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem("mindmile_token", authToken);
        updateUIForAuth();
        authModal.classList.add("hidden");
    } catch (err) {
        signupError.textContent = "Network error during signup";
    }
}

async function login() {
    loginError.textContent = "";
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                email: loginEmailInput.value.trim(),
                password: loginPasswordInput.value
            })
        });

        const data = await res.json();
        if (!res.ok) {
            loginError.textContent = data.error || "Login failed";
            return;
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem("mindmile_token", authToken);
        updateUIForAuth();
        authModal.classList.add("hidden");
    } catch (err) {
        loginError.textContent = "Network error during login";
    }
}

loginSubmit.addEventListener("click", (e) => {
    e.preventDefault();
    login();
});

signupSubmit.addEventListener("click", (e) => {
    e.preventDefault();
    signup();
});

function updateUIForAuth() {
    const profileUsername = document.getElementById("profile-username");
    const profileEmail = document.getElementById("profile-email");
    const avatar = document.getElementById("profile-avatar");

    if (currentUser) {
        profileUsername.textContent = currentUser.username;
        profileEmail.textContent = currentUser.email;
        avatar.textContent = currentUser.username.charAt(0).toUpperCase();
        btnLogin.textContent = "Logout";
        btnSignup.style.display = "none";
        btnLogin.onclick = handleLogout;
    } else {
        profileUsername.textContent = "Guest";
        profileEmail.textContent = "@guest";
        avatar.textContent = "U";
        btnLogin.textContent = "Log in";
        btnSignup.style.display = "inline-flex";
        btnLogin.onclick = () => openAuthModal("login");
    }

    loadProfile();
    loadLeaderboard();
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("mindmile_token");
    updateUIForAuth();
}

// Try to restore token
(async function initAuth() {
    const stored = localStorage.getItem("mindmile_token");
    if (!stored) {
        updateUIForAuth();
        return;
    }
    authToken = stored;
    try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
        } else {
            authToken = null;
            localStorage.removeItem("mindmile_token");
        }
    } catch (err) {
        authToken = null;
    }
    updateUIForAuth();
})();

// ---------- QUIZ LOGIC ----------
const btnStartQuiz = document.getElementById("btn-start-quiz");
const questionCountSelect = document.getElementById("question-count");

const quizQuestionText = document.getElementById("quiz-question-text");
const quizOptionsEl = document.getElementById("quiz-options");
const quizDotsEl = document.getElementById("quiz-progress-dots");
const quizProgressFill = document.getElementById("quiz-progress-fill");
const quizCurrentIndex = document.getElementById("quiz-current-index");
const quizTotal = document.getElementById("quiz-total");
const quizFeedback = document.getElementById("quiz-feedback");
const btnNextQuestion = document.getElementById("btn-next-question");
const btnQuitQuiz = document.getElementById("btn-quit-quiz");
const quizTimerEl = document.getElementById("quiz-timer");

const resultsScoreEl = document.getElementById("results-score");
const resultsCorrectEl = document.getElementById("results-correct");
const resultsWrongEl = document.getElementById("results-wrong");
const resultsTotalEl = document.getElementById("results-total");
const resultsListEl = document.getElementById("results-list");
const btnPlayAgain = document.getElementById("btn-play-again");

let quizState = {
    questions: [],
    currentIndex: 0,
    answers: {}
};

let quizTimer = null;
let quizTimeLeft = 0;

btnStartQuiz.addEventListener("click", async () => {
    const num = parseInt(questionCountSelect.value, 10) || 10;
    await startQuiz(num);
});

btnQuitQuiz.addEventListener("click", () => {
    stopTimer();
    showScreen("home-screen");
});

btnNextQuestion.addEventListener("click", () => {
    if (quizState.currentIndex < quizState.questions.length - 1) {
        quizState.currentIndex++;
        renderCurrentQuestion();
    } else {
        finishQuiz();
    }
});

btnPlayAgain.addEventListener("click", () => {
    showScreen("home-screen");
});

async function startQuiz(num) {
    try {
        const res = await fetch(`${API_BASE}/api/quiz/new?num=${num}`);
        const questions = await res.json();

        quizState = {
            questions,
            currentIndex: 0,
            answers: {}
        };

        quizTotal.textContent = questions.length;
        renderQuizDots();
        renderCurrentQuestion();
        startTimer(questions.length * 20); // 20 seconds per question
        showScreen("quiz-screen");
    } catch (err) {
        alert("Failed to start quiz. Check server.");
    }
}

function renderQuizDots() {
    quizDotsEl.innerHTML = "";
    quizState.questions.forEach((q, index) => {
        const dot = document.createElement("div");
        dot.className = "progress-dot";
        if (index === quizState.currentIndex) dot.classList.add("active");
        quizDotsEl.appendChild(dot);
    });
}

function renderCurrentQuestion() {
    const q = quizState.questions[quizState.currentIndex];
    if (!q) return;

    quizCurrentIndex.textContent = quizState.currentIndex + 1;
    quizQuestionText.textContent = q.question;
    quizOptionsEl.innerHTML = "";
    quizFeedback.textContent = "";

    q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.dataset.key = opt.key;

        const keySpan = document.createElement("span");
        keySpan.className = "option-key";
        keySpan.textContent = opt.key;

        const labelSpan = document.createElement("span");
        labelSpan.className = "option-label";
        labelSpan.textContent = opt.text;

        btn.appendChild(keySpan);
        btn.appendChild(labelSpan);

        btn.addEventListener("click", () => handleSelectOption(q, opt.key, btn));
        quizOptionsEl.appendChild(btn);
    });

    const progressPercent = (quizState.currentIndex / quizState.questions.length) * 100;
    quizProgressFill.style.width = `${progressPercent}%`;

    const dots = quizDotsEl.querySelectorAll(".progress-dot");
    dots.forEach((d, idx) => {
        d.classList.toggle("active", idx === quizState.currentIndex);
    });
}

function handleSelectOption(question, key, btnEl) {
    quizState.answers[question.id] = key;
    document.querySelectorAll(".option-btn").forEach((b) => b.classList.remove("selected"));
    btnEl.classList.add("selected");
    quizFeedback.textContent = `You chose option ${key}.`;
}

function startTimer(seconds) {
    stopTimer();
    quizTimeLeft = seconds;
    updateTimerDisplay();
    quizTimer = setInterval(() => {
        quizTimeLeft--;
        if (quizTimeLeft <= 0) {
            finishQuiz();
        }
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (quizTimer) {
        clearInterval(quizTimer);
        quizTimer = null;
    }
}

function updateTimerDisplay() {
    if (quizTimeLeft <= 0) {
        quizTimerEl.textContent = "0s";
        return;
    }
    quizTimerEl.textContent = `${quizTimeLeft}s`;
}

async function finishQuiz() {
    stopTimer();

    const answersPayload = quizState.questions.map((q) => ({
        id: q.id,
        answer: quizState.answers[q.id] || null
    }));

    try {
        const res = await fetch(`${API_BASE}/api/quiz/submit`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ answers: answersPayload })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || "Failed to submit quiz");
            return;
        }

        renderResults(data.score, data.correctCount, data.wrongCount, data.totalQuestions, data.details);
        loadProfile();
        loadLeaderboard();
        showScreen("results-screen");
    } catch (err) {
        alert("Error submitting quiz");
    }
}

function renderResults(score, correct, wrong, total, details) {
    resultsScoreEl.textContent = score;
    resultsCorrectEl.textContent = correct;
    resultsWrongEl.textContent = wrong;
    resultsTotalEl.textContent = total;

    const circle = document.getElementById("score-circle");
    const circumference = 2 * Math.PI * 50;
    const offset = circumference - (score / 100) * circumference;
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${offset}`;

    resultsListEl.innerHTML = "";
    details.forEach((d, index) => {
        const item = document.createElement("div");
        item.className = "result-item";
        item.classList.add(d.isCorrect ? "correct" : "wrong");

        const qEl = document.createElement("div");
        qEl.className = "result-q";
        qEl.textContent = `${index + 1}. ${d.question}`;

        const aEl = document.createElement("div");
        aEl.className = "result-a";

        const userText = d.userAnswer ? `You: ${d.userAnswer}` : "You: (no answer)";
        const correctText = `Correct: ${d.correctAnswer}`;
        aEl.textContent = `${userText} · ${correctText}`;

        item.appendChild(qEl);
        item.appendChild(aEl);
        resultsListEl.appendChild(item);
    });
}

// Inject gradient into SVG
(function injectScoreGradient() {
    const svg = document.querySelector(".score-ring svg");
    if (!svg) return;

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", "scoreGradient");
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "100%");
    grad.setAttribute("y2", "100%");

    const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "#22d3ee");

    const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop2.setAttribute("offset", "50%");
    stop2.setAttribute("stop-color", "#a855f7");

    const stop3 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop3.setAttribute("offset", "100%");
    stop3.setAttribute("stop-color", "#f97316");

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    grad.appendChild(stop3);
    defs.appendChild(grad);
    svg.insertBefore(defs, svg.firstChild);
})();

// ---------- PROFILE & LEADERBOARD ----------
async function loadProfile() {
    if (!authToken) {
        document.getElementById("profile-best-score").textContent = "—";
        document.getElementById("profile-avg-score").textContent = "—";
        document.getElementById("profile-games-played").textContent = "—";
        document.getElementById("profile-streak").textContent = "—";
        document.getElementById("profile-history").innerHTML =
            '<div class="history-empty">Sign in and play a quiz to start building your history.</div>';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/user/history`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) {
            return;
        }

        if (!data.length) {
            document.getElementById("profile-best-score").textContent = "—";
            document.getElementById("profile-avg-score").textContent = "—";
            document.getElementById("profile-games-played").textContent = "0";
            document.getElementById("profile-streak").textContent = "0";
            document.getElementById("profile-history").innerHTML =
                '<div class="history-empty">No games yet. Play your first Mile!</div>';
            return;
        }

        const scores = data.map((s) => s.score);
        const best = Math.max(...scores);
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

        document.getElementById("profile-best-score").textContent = best;
        document.getElementById("profile-avg-score").textContent = avg;
        document.getElementById("profile-games-played").textContent = data.length;
        document.getElementById("profile-streak").textContent = data.length;

        const historyEl = document.getElementById("profile-history");
        historyEl.innerHTML = "";
        data.forEach((s) => {
            const row = document.createElement("div");
            row.className = "history-row";
            const date = new Date(s.createdAt);
            row.innerHTML = `
        <span>${s.score}/${s.totalQuestions}</span>
        <span>${s.correctCount} correct</span>
        <span>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      `;
            historyEl.appendChild(row);
        });

        // Also update home stats
        document.getElementById("stat-best-score").textContent = best;
        document.getElementById("stat-games-played").textContent = data.length;
        document.getElementById("stat-streak").textContent = data.length;
    } catch (_) {
        // ignore
    }
}

async function loadLeaderboard() {
    try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        const data = await res.json();
        const body = document.getElementById("leaderboard-body");

        if (!Array.isArray(data) || !data.length) {
            body.innerHTML = '<div class="leaderboard-empty">No games yet. Be the first Trail Leader.</div>';
            return;
        }

        body.innerHTML = "";
        data.forEach((row) => {
            const div = document.createElement("div");
            div.className = "leaderboard-row";
            if (currentUser && row.username === currentUser.username) {
                div.classList.add("me");
            }
            const d = new Date(row.createdAt);
            div.innerHTML = `
        <span>${row.rank}</span>
        <span>${row.username}</span>
        <span>${row.score}</span>
        <span>${d.toLocaleDateString()}</span>
      `;
            body.appendChild(div);
        });
    } catch (_) {
        // ignore
    }
}

// Initial load
loadLeaderboard();