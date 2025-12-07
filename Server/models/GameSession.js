const mongoose = require("mongoose");

const gameSessionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    correctCount: { type: Number, required: true },
    wrongCount: { type: Number, required: true },
    details: [
        {
            question: String,
            correctAnswer: String,
            userAnswer: String,
            isCorrect: Boolean
        }
    ],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GameSession", gameSessionSchema);