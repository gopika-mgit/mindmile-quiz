const API_BASE = "";

// ------------- STATE -------------

let authToken = null;
let currentUser = null;

let currentQuestions = [];
let currentAnswers = {}; // {questionId: "A" | "B" | ...}
let currentIndex = 0;
let totalQuestions = 10;

const QUESTION_COUNTS = [5, 10, 25, 50];

// ------------- HELPERS -------------

function $(id) {
    return document.getElementById(id);
}

function showView(viewId) {
    const views = document.querySelectorAll(".view");
    views.forEach((v) => v.classList.remove("visible"));
    const target = $(viewId);
    if (target) target.classList.add("visible");
}

function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}

function formatDateTime(isoString) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function authHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// ------------- AUTH UI -------------

function updateAuthUI() {
    const authButtons = $("auth-buttons");
    const userPill = $("user-pill");
    const logoutBtn = $("btn-logout");

    if (currentUser && authToken) {
        if (authButtons) authButtons.classList.add("hidden");
        if (logoutBtn) logoutBtn.classList.remove("hidden");
        if (userPill) {
            userPill.classList.remove("hidden");
            userPill.textContent = currentUser.username || currentUser.email;
        }
        const profileBanner = $("profile-banner");
        if (profileBanner) {
            profileBanner.classList.remove("warning");
            profileBanner.classList.add("info");
            profileBanner.textContent =
                "Your recent MindMile runs, saved to this account.";
        }
    } else {
        if (authButtons) authButtons.classList.remove("hidden");
        if (logoutBtn) logoutBtn.classList.add("hidden");
        if (userPill) {
            userPill.classList.add("hidden");
            userPill.textContent = "";
        }
        const profileBanner = $("profile-banner");
        if (profileBanner) {
            profileBanner.classList.remove("info");
            profileBanner.classList.add("warning");
            profileBanner.textContent =
                "Sign in or create an account to start saving your quiz history.";
        }
    }
}

function saveAuth(token, user) {
    authToken = token;
    currentUser = user;
    try {
        localStorage.setItem("mm_auth_token", token || "");
        localStorage.setItem("mm_auth_user", user ? JSON.stringify(user) : "");
    } catch (e) {
        console.warn("Unable to persist auth to localStorage", e);
    }
    updateAuthUI();
}

function loadAuthFromStorage() {
    try {
        const token = localStorage.getItem("mm_auth_token");
        const userStr = localStorage.getItem("mm_auth_user");
        if (token && userStr) {
            authToken = token;
            currentUser = JSON.parse(userStr);
        }
    } catch (e) {
        console.warn("Unable to read auth from localStorage", e);
    }
    updateAuthUI();
}

// ------------- QUESTION COUNT -------------

function setQuestionCount(count) {
    totalQuestions = count;

    // highlight active chip
    const chips = document.querySelectorAll(".count-chip");
    chips.forEach((chip) => {
        const c = parseInt(chip.dataset.count, 10);
        if (c === count) chip.classList.add("active");
        else chip.classList.remove("active");
    });

    // reset home progress indicator
    setText("home-progress-label", `0 / ${totalQuestions}`);
    const fill = $("home-progress-fill");
    if (fill) fill.style.width = "0%";
}

// ------------- QUIZ FLOW -------------

function renderQuestion() {
    if (!currentQuestions.length) {
        setText(
            "quiz-question-text",
            "Start a run to see questions from the MindMile bank."
        );
        $("quiz-options").innerHTML = "";
        setText("quiz-step-label", "Question 0 of 0");
        if ($("quiz-progress-fill")) $("quiz-progress-fill").style.width = "0%";
        return;
    }

    const q = currentQuestions[currentIndex];
    const stepLabel = $("quiz-step-label");
    if (stepLabel) {
        stepLabel.textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;
    }

    const progressFill = $("quiz-progress-fill");
    if (progressFill) {
        const pct = (currentIndex / totalQuestions) * 100;
        progressFill.style.width = `${Math.max(4, pct)}%`;
    }

    setText("quiz-question-text", q.question);

    const optionsContainer = $("quiz-options");
    optionsContainer.innerHTML = "";

    q.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-option";
        btn.dataset.key = opt.key;
        btn.innerHTML = `
      <div class="quiz-option-key">${opt.key}</div>
      <span>${opt.text}</span>
    `;
        const existing = currentAnswers[q.id];
        if (existing === opt.key) btn.classList.add("selected");

        btn.addEventListener("click", () => {
            currentAnswers[q.id] = opt.key;
            renderQuestion();
        });

        optionsContainer.appendChild(btn);
    });
}

async function startNewQuiz() {
    try {
        const res = await fetch(`/api/quiz/new?num=${totalQuestions}`);
        if (!res.ok) throw new Error("Failed to get questions");
        const data = await res.json();
        currentQuestions = Array.isArray(data) ? data : [];
        currentAnswers = {};
        currentIndex = 0;

        // Update home sample preview
        if (currentQuestions.length > 0) {
            const first = currentQuestions[0];
            const sample = $("home-sample-question");
            if (sample) sample.textContent = `"${first.question}"`;
        }

        const pill = $("quiz-session-pill");
        if (pill) {
            pill.textContent = currentUser ? "Signed-in run" : "Guest run";
        }

        showView("view-quiz");
        renderQuestion();
    } catch (err) {
        console.error("Error starting quiz", err);
        alert("Unable to start quiz. Check that the server is running.");
    }
}

function goToNextQuestion() {
    if (!currentQuestions.length) return;
    if (currentIndex < currentQuestions.length - 1) {
        currentIndex += 1;
        renderQuestion();
    } else {
        submitQuiz();
    }
}

async function submitQuiz() {
    if (!currentQuestions.length) return;

    const payloadAnswers = currentQuestions.map((q) => ({
        id: q.id,
        answer: currentAnswers[q.id] || null,
    }));

    try {
        const res = await fetch("/api/quiz/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...authHeaders(),
            },
            body: JSON.stringify({ answers: payloadAnswers }),
        });

        if (!res.ok) throw new Error("Submit failed");
        const data = await res.json();

        setText("result-score", `${data.score || 0}%`);
        setText("result-total", data.totalQuestions || 0);
        setText("result-correct", data.correctCount || 0);
        setText("result-wrong", data.wrongCount || 0);

        const caption = $("result-caption");
        if (caption) {
            if (data.score >= 80) {
                caption.textContent =
                    "Strong run. You’re comfortably above average for this set.";
            } else if (data.score >= 50) {
                caption.textContent =
                    "Solid baseline. Another run with a fresh set will push this up.";
            } else {
                caption.textContent =
                    "Good starting point. MindMile is built for repetition – try again with a new set.";
            }
        }

        const savedFlag = $("result-saved-flag");
        if (savedFlag) {
            savedFlag.textContent = data.saved
                ? "Saved to your profile"
                : "Guest run (not saved)";
        }

        const avgEl = $("home-average-score");
        if (avgEl) {
            avgEl.textContent = `${data.score || 0}%`;
        }

        setText("home-progress-label", `0 / ${totalQuestions}`);
        const fill = $("home-progress-fill");
        if (fill) fill.style.width = "0%";

        showView("view-results");

        if (currentUser) {
            fetchHistory();
        }
        fetchLeaderboard();
    } catch (err) {
        console.error("Error submitting quiz", err);
        alert("Unable to submit quiz. Check your connection.");
    }
}

// ------------- PROFILE / LEADERBOARD -------------

async function fetchHistory() {
    if (!currentUser || !authToken) {
        const list = $("history-list");
        if (list) list.innerHTML = "";
        return;
    }
    try {
        const res = await fetch("/api/user/history", {
            headers: authHeaders(),
        });
        if (!res.ok) throw new Error("History fetch failed");
        const history = await res.json();
        const list = $("history-list");
        if (!list) return;
        list.innerHTML = "";

        if (!history.length) {
            list.innerHTML = `<div class="muted small">No saved runs yet. Play a signed-in run to see it here.</div>`;
            return;
        }

        history.forEach((item) => {
            const row = document.createElement("div");
            row.className = "history-item";
            row.innerHTML = `
        <div>
          <div>${item.score}% • ${item.correctCount}/${item.totalQuestions} correct</div>
          <div class="history-meta">${formatDateTime(item.createdAt)}</div>
        </div>
        <div class="history-meta">Wrong: ${item.wrongCount}</div>
      `;
            list.appendChild(row);
        });
    } catch (err) {
        console.error("History error", err);
    }
}

async function fetchLeaderboard() {
    try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error("Leaderboard fetch failed");
        const data = await res.json();
        const tbody = $("leaderboard-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!data.length) {
            tbody.innerHTML = `<tr><td colspan="5" class="muted small">No runs recorded yet.</td></tr>`;
            return;
        }

        data.forEach((row) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>${row.rank}</td>
        <td>${row.username || "Guest"}</td>
        <td>${row.score}%</td>
        <td>${row.totalQuestions}</td>
        <td>${formatDateTime(row.createdAt)}</td>
      `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Leaderboard error", err);
    }
}

// ------------- AUTH MODAL -------------

function openAuthModal(mode) {
    const backdrop = $("auth-modal-backdrop");
    if (!backdrop) return;
    backdrop.classList.remove("hidden");

    const loginForm = $("form-login");
    const signupForm = $("form-signup");
    const tabLogin = $("tab-login");
    const tabSignup = $("tab-signup");
    const title = $("auth-modal-title");
    const subtitle = $("auth-modal-subtitle");
    const loginError = $("login-error");
    const signupError = $("signup-error");
    if (loginError) {
        loginError.classList.add("hidden");
        loginError.textContent = "";
    }
    if (signupError) {
        signupError.classList.add("hidden");
        signupError.textContent = "";
    }

    if (mode === "signup") {
        if (loginForm) loginForm.classList.add("hidden");
        if (signupForm) signupForm.classList.remove("hidden");
        if (tabLogin) tabLogin.classList.remove("active");
        if (tabSignup) tabSignup.classList.add("active");
        if (title) title.textContent = "Create your MindMile account";
        if (subtitle)
            subtitle.textContent =
                "Save your progress and see where you rank on the leaderboard.";
    } else {
        if (loginForm) loginForm.classList.remove("hidden");
        if (signupForm) signupForm.classList.add("hidden");
        if (tabLogin) tabLogin.classList.add("active");
        if (tabSignup) tabSignup.classList.remove("active");
        if (title) title.textContent = "Welcome back";
        if (subtitle)
            subtitle.textContent =
                "Log in to sync your progress and climb the leaderboard.";
    }
}

function closeAuthModal() {
    const backdrop = $("auth-modal-backdrop");
    if (backdrop) backdrop.classList.add("hidden");
}

// ------------- AUTH REQUESTS -------------

async function handleLogin(e) {
    e.preventDefault();
    const email = $("login-email").value.trim();
    const password = $("login-password").value.trim();
    const errorBox = $("login-error");
    if (errorBox) {
        errorBox.classList.add("hidden");
        errorBox.textContent = "";
    }

    if (!email || !password) {
        if (errorBox) {
            errorBox.textContent = "Email and password are required.";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Login failed");
        }
        saveAuth(data.token, data.user);
        closeAuthModal();
        fetchHistory();
    } catch (err) {
        console.error("Login error", err);
        if (errorBox) {
            errorBox.textContent = err.message;
            errorBox.classList.remove("hidden");
        }
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const username = $("signup-username").value.trim();
    const email = $("signup-email").value.trim();
    const password = $("signup-password").value.trim();
    const errorBox = $("signup-error");
    if (errorBox) {
        errorBox.classList.add("hidden");
        errorBox.textContent = "";
    }

    if (!username || !email || !password) {
        if (errorBox) {
            errorBox.textContent = "All fields are required.";
            errorBox.classList.remove("hidden");
        }
        return;
    }

    try {
        const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Signup failed");
        }
        saveAuth(data.token, data.user);
        closeAuthModal();
        fetchHistory();
    } catch (err) {
        console.error("Signup error", err);
        if (errorBox) {
            errorBox.textContent = err.message;
            errorBox.classList.remove("hidden");
        }
    }
}

// ------------- INIT -------------

function initQuestionCountSelector() {
    const container = document.querySelector(".count-selector");
    if (!container) return;

    const chips = container.querySelectorAll(".count-chip");
    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            const count = parseInt(chip.dataset.count, 10);
            if (!Number.isNaN(count)) {
                setQuestionCount(count);
            }
        });
    });

    // default: 10 questions
    if (QUESTION_COUNTS.includes(10)) {
        setQuestionCount(10);
    } else if (QUESTION_COUNTS.length) {
        setQuestionCount(QUESTION_COUNTS[0]);
    }
}

function initNav() {
    const homeBtn = $("nav-home");
    const quizBtn = $("nav-quiz");
    const profileBtn = $("nav-profile");
    const lbBtn = $("nav-leaderboard");

    if (homeBtn) homeBtn.addEventListener("click", () => showView("view-home"));
    if (quizBtn) quizBtn.addEventListener("click", () => showView("view-quiz"));
    if (profileBtn)
        profileBtn.addEventListener("click", () => {
            showView("view-profile");
            fetchHistory();
        });
    if (lbBtn)
        lbBtn.addEventListener("click", () => {
            showView("view-leaderboard");
            fetchLeaderboard();
        });
}

function initHomeActions() {
    const startBtn = $("btn-start-quiz");
    const loginHero = $("btn-open-login-hero");

    if (startBtn)
        startBtn.addEventListener("click", () => {
            // visually show we've started
            setText("home-progress-label", `1 / ${totalQuestions}`);
            const fill = $("home-progress-fill");
            if (fill)
                fill.style.width = `${Math.max(8, (1 / totalQuestions) * 100)}%`;
            startNewQuiz();
        });

    if (loginHero) {
        loginHero.addEventListener("click", () => openAuthModal("login"));
    }
}

function initQuizActions() {
    const nextBtn = $("btn-next-question");
    const quitBtn = $("btn-quit-quiz");
    const playAgainBtn = $("btn-play-again");
    const resultsHomeBtn = $("btn-results-home");

    if (nextBtn) nextBtn.addEventListener("click", () => goToNextQuestion());

    if (quitBtn)
        quitBtn.addEventListener("click", () => {
            currentQuestions = [];
            currentAnswers = {};
            currentIndex = 0;
            setText(
                "quiz-question-text",
                "Run cancelled. Start a new quiz from the home screen."
            );
            $("quiz-options").innerHTML = "";
            if ($("quiz-progress-fill")) $("quiz-progress-fill").style.width = "0%";
            showView("view-home");
        });

    if (playAgainBtn) playAgainBtn.addEventListener("click", () => startNewQuiz());

    if (resultsHomeBtn)
        resultsHomeBtn.addEventListener("click", () => showView("view-home"));
}

function initAuthUI() {
    const openLoginBtn = $("btn-open-login");
    const openSignupBtn = $("btn-open-signup");
    const tabLogin = $("tab-login");
    const tabSignup = $("tab-signup");
    const modalClose = $("auth-modal-close");
    const logoutBtn = $("btn-logout");

    const loginForm = $("form-login");
    const signupForm = $("form-signup");

    if (openLoginBtn) {
        openLoginBtn.addEventListener("click", () => openAuthModal("login"));
    }
    if (openSignupBtn) {
        openSignupBtn.addEventListener("click", () => openAuthModal("signup"));
    }

    const heroLoginBtn = $("btn-open-login-hero");
    if (heroLoginBtn) {
        heroLoginBtn.addEventListener("click", () => openAuthModal("login"));
    }

    if (tabLogin) {
        tabLogin.addEventListener("click", () => openAuthModal("login"));
    }
    if (tabSignup) {
        tabSignup.addEventListener("click", () => openAuthModal("signup"));
    }
    if (modalClose) {
        modalClose.addEventListener("click", () => closeAuthModal());
    }
    const backdrop = $("auth-modal-backdrop");
    if (backdrop) {
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) closeAuthModal();
        });
    }

    if (loginForm) loginForm.addEventListener("submit", handleLogin);
    if (signupForm) signupForm.addEventListener("submit", handleSignup);

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            saveAuth(null, null);
            fetchHistory();
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadAuthFromStorage();
    initNav();
    initHomeActions();
    initQuizActions();
    initAuthUI();
    initQuestionCountSelector();

    showView("view-home");
    fetchLeaderboard();
});