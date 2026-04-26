import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // In-memory quiz state
  const quizState = {
    roomCode: Math.floor(100000 + Math.random() * 900000).toString(),
    adminKey: Math.random().toString(36).substr(2, 12),
    questions: [] as any[],
    currentQuestionIndex: -1,
    participants: {} as Record<string, { id: string; name: string; score: number; lastAnswer: any; lastAnswerCorrect: boolean | null }>,
    status: "LOBBY" as "LOBBY" | "QUESTION" | "FEEDBACK" | "FINISHED",
    timeLeft: 0,
    isLocked: false,
    pacing: "manual" as "manual" | "auto",
    questionStats: [] as { correct: number; incorrect: number }[],
  };

  const resetState = () => {
    quizState.roomCode = Math.floor(100000 + Math.random() * 900000).toString();
    quizState.adminKey = Math.random().toString(36).substr(2, 12);
    quizState.questions.length = 0;
    quizState.currentQuestionIndex = -1;
    // Clear participants object keys
    for (const key in quizState.participants) delete quizState.participants[key];
    quizState.status = "LOBBY";
    quizState.timeLeft = 0;
    quizState.isLocked = false;
    quizState.pacing = "manual";
    quizState.questionStats.length = 0;
  };

  let timerInterval: NodeJS.Timeout | null = null;
  let autoPilotTimeout: NodeJS.Timeout | null = null;

  const broadcastState = () => {
    console.log(`Broadcasting state. Room: ${quizState.roomCode}, Status: ${quizState.status}, Participants: ${Object.keys(quizState.participants).length}`);
    io.emit("quiz_state", quizState);
  };

  const startTimer = (seconds: number, onEnd: () => void) => {
    if (timerInterval) clearInterval(timerInterval);
    quizState.timeLeft = seconds;
    broadcastState();

    timerInterval = setInterval(() => {
      quizState.timeLeft--;
      if (quizState.timeLeft <= 0) {
        if (timerInterval) clearInterval(timerInterval);
        onEnd();
      } else {
        broadcastState();
      }
    }, 1000);
  };

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    socket.emit("quiz_state", quizState);

    // Admin events
    socket.on("admin:create_quiz", (questions) => {
      quizState.questions = questions;
      quizState.status = "LOBBY";
      quizState.currentQuestionIndex = -1;
      quizState.participants = {};
      quizState.isLocked = false;
      quizState.questionStats = questions.map(() => ({ correct: 0, incorrect: 0 }));
      quizState.adminKey = Math.random().toString(36).substr(2, 12);
      socket.emit("admin:key", quizState.adminKey);
      broadcastState();
    });

    socket.on("admin:reconnect", (key) => {
      if (key === quizState.adminKey) {
        socket.emit("admin:key", quizState.adminKey);
        socket.emit("quiz_state", quizState);
      }
    });

    socket.on("admin:toggle_lock", () => {
      quizState.isLocked = !quizState.isLocked;
      broadcastState();
    });

    socket.on("admin:set_pacing", (mode) => {
      quizState.pacing = mode;
      broadcastState();
    });

    socket.on("admin:kick_participant", (id) => {
      if (quizState.participants[id]) {
        delete quizState.participants[id];
        io.to(id).emit("kicked");
        broadcastState();
      }
    });

    const startNextQuestion = () => {
      if (autoPilotTimeout) clearTimeout(autoPilotTimeout);
      if (quizState.currentQuestionIndex < quizState.questions.length - 1) {
        quizState.currentQuestionIndex++;
        quizState.status = "QUESTION";
        // Reset participant answers for new question
        Object.values(quizState.participants).forEach(p => {
          p.lastAnswer = null;
          p.lastAnswerCorrect = null;
        });
        
        const timeLimit = quizState.questions[quizState.currentQuestionIndex].timeLimit || 15;
        startTimer(timeLimit, () => {
          quizState.status = "FEEDBACK";
          broadcastState();
          
          if (quizState.pacing === "auto") {
            autoPilotTimeout = setTimeout(() => {
              startNextQuestion();
            }, 5000); // 5s break between questions
          }
        });
      } else {
        quizState.status = "FINISHED";
        broadcastState();
      }
    };

    socket.on("admin:start_next_question", startNextQuestion);

    socket.on("admin:reset", () => {
      resetState();
      if (timerInterval) clearInterval(timerInterval);
      if (autoPilotTimeout) clearTimeout(autoPilotTimeout);
      broadcastState();
    });

    // Participant events
    socket.on("participant:join", ({ name, code }) => {
      if (quizState.isLocked) {
        socket.emit("join_error", "Room is locked");
        return;
      }
      const providedCode = String(code).trim();
      console.log(`Join attempt: Name=${name}, Provided=${providedCode}, Actual=${quizState.roomCode}`);
      if (providedCode === quizState.roomCode) {
        quizState.participants[socket.id] = { id: socket.id, name, score: 0, lastAnswer: null, lastAnswerCorrect: null };
        socket.emit("join_success");
        broadcastState();
      } else {
        socket.emit("join_error", "Invalid Room Code");
      }
    });

    socket.on("participant:answer", (answer) => {
      const p = quizState.participants[socket.id];
      if (p && quizState.status === "QUESTION" && p.lastAnswer === null) {
        const currentQ = quizState.questions[quizState.currentQuestionIndex];
        p.lastAnswer = answer;
        
        let isCorrect = false;
        const qType = currentQ.type || "multiple-choice";

        if (qType === "multiple-choice" || qType === "true-false") {
          isCorrect = currentQ.correctAnswer === answer;
        } else if (qType === "fill-blank") {
          const studentAnswer = String(answer).toLowerCase().trim();
          const correctArr = Array.isArray(currentQ.correctAnswer) ? currentQ.correctAnswer : [currentQ.correctAnswer];
          isCorrect = correctArr.some((a: string) => String(a).toLowerCase().trim() === studentAnswer);
        } else if (qType === "match") {
          // answer is expected to be a map of { leftIdx: rightIdx }
          // correctAnswer is also a map of { leftIdx: rightIdx }
          isCorrect = JSON.stringify(currentQ.correctAnswer) === JSON.stringify(answer);
        } else if (qType === "multi-select") {
          // answer is expected to be an array of indices
          // correctAnswer is also an array of indices
          if (Array.isArray(answer) && Array.isArray(currentQ.correctAnswer)) {
            const studentAns = [...answer].sort();
            const correctAns = [...currentQ.correctAnswer].sort();
            isCorrect = studentAns.length === correctAns.length && studentAns.every((val, index) => val === correctAns[index]);
          }
        }

        p.lastAnswerCorrect = isCorrect;
        
        // Update stats
        const stats = quizState.questionStats[quizState.currentQuestionIndex];
        if (stats) {
          if (isCorrect) stats.correct++;
          else stats.incorrect++;
        }
        
        if (isCorrect) {
          // Bonus points for speed: base 1000 + (timeLeft * 20)
          p.score += 1000 + (quizState.timeLeft * 20);
        }
        
        // Check if everyone has answered to fast-forward
        const allAnswered = Object.values(quizState.participants).length > 0 && 
                            Object.values(quizState.participants).every(part => part.lastAnswer !== null);
        if (allAnswered) {
          if (timerInterval) clearInterval(timerInterval);
          quizState.status = "FEEDBACK";
          
          if (quizState.pacing === "auto") {
            autoPilotTimeout = setTimeout(() => {
              startNextQuestion();
            }, 5000);
          }
        }
        broadcastState();
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
