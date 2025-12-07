const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("./models/User");
const GameSession = require("./models/GameSession");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json());

// ---------- DB CONNECTION ----------
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));

// ---------- LOAD QUESTIONS ----------
const questionsPath = path.join(__dirname, "questions.json");
let QUESTIONS = [];

try {
    const raw = fs.readFileSync(questionsPath, "utf-8");
    const parsed = JSON.parse(raw);

    QUESTIONS = parsed.map((q, index) => ({
        id: index,
        ...q
    }));

    console.log(`✅ Loaded ${QUESTIONS.length} questions from questions.json`);
} catch (err) {
    console.error("Error loading questions.json:", err);
}

// ---------- HELPERS ----------
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function pickRandomQuestions(count) {
    const shuffled = shuffle(QUESTIONS);
    return shuffled.slice(0, count);
}

function createToken(user) {
    return jwt.sign(
        {
            id: user._id.toString(),
            username: user.username,
            email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function authRequired(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

// ---------- AUTH ROUTES ----------

// Signup
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ error: "Email already in use" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email, passwordHash });

        const token = createToken(user);

        res.json({
            token,
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Server error during signup" });
    }
});

// Login
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const token = createToken(user);

        res.json({
            token,
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Server error during login" });
    }
});

// Get current user
app.get("/api/auth/me", authRequired, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("username email");
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        console.error("Me error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ---------- QUIZ ROUTES ----------

// Health check
app.get("/api/ping", (req, res) => {
    res.json({ ok: true, message: "Quiz API is alive" });
});

// Get random questions from JSON bank
app.get("/api/quiz/new", (req, res) => {
    const num = parseInt(req.query.num, 10) || 10;
    const selected = pickRandomQuestions(num);

    const safe = selected.map((q) => ({
        id: q.id,
        question: q.question,
        options: [
            { key: "A", text: q.A },
            { key: "B", text: q.B },
            { key: "C", text: q.C },
            { key: "D", text: q.D }
        ]
    }));

    res.json(safe);
});

// Submit quiz
app.post("/api/quiz/submit", async (req, res) => {
    try {
        const { answers } = req.body;

        if (!Array.isArray(answers)) {
            return res.status(400).json({ error: "answers array is required" });
        }

        let correctCount = 0;
        const details = [];

        answers.forEach((ans) => {
            const q = QUESTIONS.find((q) => q.id === ans.id);
            if (!q) return;

            const isCorrect = q.answer === ans.answer;
            if (isCorrect) correctCount++;

            details.push({
                question: q.question,
                correctAnswer: q.answer,
                userAnswer: ans.answer || null,
                isCorrect
            });
        });

        const total = answers.length;
        const wrongCount = total - correctCount;
        const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

        // Save session in DB if logged in
        let sessionDoc = null;
        if (req.headers.authorization) {
            try {
                const header = req.headers.authorization || "";
                const token = header.startsWith("Bearer ") ? header.slice(7) : null;
                if (token) {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    sessionDoc = await GameSession.create({
                        user: decoded.id,
                        score,
                        totalQuestions: total,
                        correctCount,
                        wrongCount,
                        details
                    });
                }
            } catch (err) {
                console.warn("Quiz submitted with invalid token, not saving session.");
            }
        }

        res.json({
            score,
            correctCount,
            wrongCount,
            totalQuestions: total,
            details,
            saved: !!sessionDoc
        });
    } catch (err) {
        console.error("Submit quiz error:", err);
        res.status(500).json({ error: "Server error during quiz submission" });
    }
});

// ---------- PROFILE & LEADERBOARD ----------
app.get("/api/user/history", authRequired, async (req, res) => {
    try {
        const sessions = await GameSession.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(30);

        const payload = sessions.map((s) => ({
            id: s._id.toString(),
            score: s.score,
            totalQuestions: s.totalQuestions,
            correctCount: s.correctCount,
            wrongCount: s.wrongCount,
            createdAt: s.createdAt
        }));

        res.json(payload);
    } catch (err) {
        console.error("History error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/api/leaderboard", async (req, res) => {
    try {
        const top = await GameSession.find({})
            .populate("user", "username")
            .sort({ score: -1, createdAt: 1 })
            .limit(10);

        const payload = top.map((s, index) => ({
            rank: index + 1,
            username: s.user ? s.user.username : "Guest",
            score: s.score,
            totalQuestions: s.totalQuestions,
            createdAt: s.createdAt
        }));

        res.json(payload);
    } catch (err) {
        console.error("Leaderboard error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ---------- STATIC FRONTEND ----------
const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(clientPath));

// Express 5-safe catch-all with regex
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
    console.log(`🚀 MindMile Trivia running at http://localhost:${PORT}`);
});