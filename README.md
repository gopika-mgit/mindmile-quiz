# MindMile Trivia – Full-Stack Quiz Application

MindMile Trivia is a full-stack quiz application built with a clear client–server architecture. The server is responsible for serving questions, handling authentication, scoring, and persistence, while the frontend provides an interactive quiz experience with a clean, animated UI.

This project was developed for **Project 2: Quiz App** and implements all required features: home/quiz/results pages, signup/login with MongoDB, user profiles, and a leaderboard, plus several enhancements.

---

## Live Links

- **Live App:** https://mindmile-quiz.onrender.com  
- **GitHub Repository:** https://github.com/gopika-mgit/mindmile-quiz

---

## Features

### Core Requirements

- **Home Page**
  - Start a new quiz run.
  - Choose how many questions you want (5, 10, 25, 50).
  - Shows a live “run preview” card with a sample question.

- **Quiz Page**
  - Displays one question at a time with four options.
  - Shows progress (e.g., “Question 3 of 10”) and a progress bar.
  - Options highlight when selected.
  - “Next” button to move through the quiz.
  - “Quit run” button to go back if you want to stop.

- **Results Page**
  - Shows final score as a percentage.
  - Shows total questions, number correct, and number wrong/empty.
  - Buttons to play another set or go back home.

- **Signup / Login**
  - Users can create an account with username, email, and password.
  - Passwords are hashed using **bcrypt** (no plain-text passwords stored).
  - Login returns a **JWT token** that is stored on the client.
  - Logged-in state is preserved across refreshes until logout.

- **User Profile Page**
  - Shows a list of previous quiz runs for the logged-in user.
  - Each item includes score, total questions, and date/time.

- **Leaderboard Page**
  - Shows the top 10 highest-scoring runs across all users.
  - Displays rank, username, score, number of questions, and timestamp.

### Extra / Enhanced Features

- **Dynamic Question Counts**
  - User can choose 5, 10, 25, or 50 questions per run.

- **Randomized Question Sets**
  - Questions are drawn from the instructor’s `questions.json`.
  - Each run gets a shuffled set so repeated plays aren’t identical.

- **Guest Mode**
  - Users can play without signing in.
  - Scores are not saved in the database unless the user is logged in.

- **Modern UI**
  - Gradient background with subtle animations and glow.
  - Card-based layout with progress bars and pills.
  - Responsive layout for smaller screens.

---

## Tech Stack

### Frontend

- HTML5
- CSS3 (custom, no UI framework)
- Vanilla JavaScript (`client/main.js`)

### Backend

- Node.js
- Express.js
- Mongoose (MongoDB ODM)
- JSON Web Tokens (JWT) for authentication
- bcryptjs for password hashing
- dotenv for environment variables

### Database

- MongoDB Atlas (cloud-hosted MongoDB)

### Deployment

- Render (Web Service)
- Environment variables configured in Render dashboard

---

## Project Structure

```bash
MindMile Trivia/
├── Server/
│   ├── server.js             # Express app, routes, auth, quiz logic
│   └── models/
│       ├── User.js           # User schema (username, email, passwordHash)
│       └── GameSession.js    # Quiz session schema (score, counts, user ref)
│
├── client/
│   ├── index.html            # Main single-page UI
│   ├── styles.css            # Layout, gradients, animations
│   └── main.js               # Frontend logic and API calls
│
├── questions.json            # Instructor-provided question bank
├── package.json              # Dependencies and scripts
├── package-lock.json
└── .env                      # Local environment variables 
