
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on("connection", socket => {
  const id = socket.id;

  socket.on("createRoom", callback => {
    const code = generateRoomCode();
    rooms[code] = { host: id, players: {}, question: null, answersOpen: false };
    socket.join(code);
    callback(code);
  });

  socket.on("joinRoom", ({ roomCode, name }, callback) => {
    const room = rooms[roomCode];
    if (!room) return callback({ success: false, message: "Room not found" });
    if (Object.keys(room.players).length >= 6)
      return callback({ success: false, message: "Room full" });

    room.players[id] = { name, score: 0, answer: null };
    socket.join(roomCode);
    io.to(roomCode).emit("playersUpdate", Object.values(room.players));
    callback({ success: true });
  });

  socket.on("sendQuestion", ({ roomCode, question, options }) => {
    const room = rooms[roomCode];
    if (!room || id !== room.host) return;
    room.question = { question, options };
    room.answersOpen = true;
    io.to(roomCode).emit("newQuestion", room.question);
  });

  socket.on("answer", ({ roomCode, answerIndex }) => {
    const room = rooms[roomCode];
    if (!room || !room.answersOpen) return;
    if (room.players[id]) room.players[id].answer = answerIndex;
  });

  socket.on("closeAnswers", ({ roomCode, correctIndex }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.answersOpen = false;
    for (const p of Object.values(room.players)) {
      if (p.answer === correctIndex) p.score += 100;
    }
    io.to(roomCode).emit("showResults", room.players);
  });

  socket.on("disconnect", () => {
    for (const code in rooms) {
      const room = rooms[code];
      if (!room) continue;
      delete room.players[id];
      io.to(code).emit("playersUpdate", Object.values(room.players));
    }
  });
});

const port = process.env.PORT || 3000;
httpServer.listen(port, () => console.log("Server running on port", port));
