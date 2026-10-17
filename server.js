
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "who_wins",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4"
});

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

function makeId() {
  return crypto.randomBytes(8).toString("hex");
}

function hashVoter(voterId) {
  return crypto.createHash("sha256").update(voterId).digest("hex");
}

function validText(value, maxLength) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength;
}

function validVoterId(value) {
  return typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 200;
}

function getVoterId(req) {
  return req.body?.voterId || req.query?.voterId;
}

async function getPolls(voterId, pollId = null) {
  const voterHash = validVoterId(voterId) ? hashVoter(voterId) : null;

  const params = [];
  let where = "";

  if (pollId) {
    where = "WHERE p.id = ?";
    params.push(pollId);
  }

  const [pollRows] = await pool.execute(
    `SELECT p.id, p.question, p.question_ar AS questionAr, p.created_at AS createdAt
     FROM polls p
     ${where}
     ORDER BY p.created_at DESC
     LIMIT 200`,
    params
  );

  if (!pollRows.length) return [];

  const ids = pollRows.map((poll) => poll.id);
  const placeholders = ids.map(() => "?").join(",");

  const [optionRows] = await pool.execute(
    `SELECT o.id, o.poll_id AS pollId, o.label,
            o.label_ar AS labelAr, o.position,
            COUNT(v.id) AS votes
     FROM options o
     LEFT JOIN votes v ON v.option_id = o.id
     WHERE o.poll_id IN (${placeholders})
     GROUP BY o.id, o.poll_id, o.label, o.label_ar, o.position
     ORDER BY o.poll_id, o.position`,
    ids
  );

  let votedRows = [];

  if (voterHash) {
    [votedRows] = await pool.execute(
      `SELECT poll_id AS pollId, option_id AS optionId
       FROM votes
       WHERE voter_hash = ? AND poll_id IN (${placeholders})`,
      [voterHash, ...ids]
    );
  }

  const votedMap = new Map(votedRows.map((row) => [row.pollId, row.optionId]));

  return pollRows.map((poll) => {
    const options = optionRows
      .filter((option) => option.pollId === poll.id)
      .map((option) => ({
        id: option.id,
        label: option.label,
        labelAr: option.labelAr,
        votes: Number(option.votes)
      }));

    return {
      ...poll,
      options,
      totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
      hasVoted: votedMap.has(poll.id),
      votedOptionId: votedMap.get(poll.id) || null
    };
  });
}

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch {
    res.status(503).json({ ok: false, database: "disconnected" });
  }
});

app.get("/api/polls", async (req, res) => {
  try {
    const polls = await getPolls(getVoterId(req));
    res.json({ polls });
  } catch (error) {
    console.error("Load polls error:", error.message);
    res.status(500).json({ error: "Could not load battles." });
  }
});

app.get("/api/polls/:id", async (req, res) => {
  try {
    const polls = await getPolls(getVoterId(req), req.params.id);

    if (!polls.length) {
      return res.status(404).json({ error: "Battle not found." });
    }

    res.json({ poll: polls[0] });
  } catch (error) {
    console.error("Load battle error:", error.message);
    res.status(500).json({ error: "Could not load battle." });
  }
});

app.post("/api/polls", async (req, res) => {
  const { question, questionAr, options, optionsAr, voterId } = req.body || {};

  if (
    !validText(question, 100) ||
    !Array.isArray(options) ||
    options.length !== 2 ||
    !options.every((option) => validText(option, 50)) ||
    !validVoterId(voterId)
  ) {
    return res.status(400).json({ error: "Invalid battle details." });
  }

  if (options[0].trim().toLowerCase() === options[1].trim().toLowerCase()) {
    return res.status(400).json({ error: "Options must be different." });
  }

  const safeQuestionAr = validText(questionAr, 100)
    ? questionAr.trim()
    : question.trim();

  const safeOptionsAr = Array.isArray(optionsAr) && optionsAr.length === 2
    ? optionsAr.map((value, i) =>
        validText(value, 50) ? value.trim() : options[i].trim()
      )
    : options.map((value) => value.trim());

  const pollId = makeId();
  const optionIds = [makeId(), makeId()];
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO polls (id, question, question_ar)
       VALUES (?, ?, ?)`,
      [pollId, question.trim(), safeQuestionAr]
    );

    for (let i = 0; i < 2; i++) {
      await connection.execute(
        `INSERT INTO options
         (id, poll_id, label, label_ar, position)
         VALUES (?, ?, ?, ?, ?)`,
        [
          optionIds[i],
          pollId,
          options[i].trim(),
          safeOptionsAr[i],
          i + 1
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      poll: {
        id: pollId,
        question: question.trim(),
        questionAr: safeQuestionAr,
        totalVotes: 0,
        hasVoted: false,
        votedOptionId: null,
        options: optionIds.map((id, i) => ({
          id,
          label: options[i].trim(),
          labelAr: safeOptionsAr[i],
          votes: 0
        }))
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create battle error:", error.message);
    res.status(500).json({ error: "Could not create battle." });
  } finally {
    connection.release();
  }
});

app.post("/api/polls/:id/vote", async (req, res) => {
  const { optionId, voterId } = req.body || {};
  const pollId = req.params.id;

  if (
    !/^[a-f0-9]{16}$/.test(pollId) ||
    typeof optionId !== "string" ||
    !/^[a-f0-9]{16}$/.test(optionId) ||
    !validVoterId(voterId)
  ) {
    return res.status(400).json({ error: "Invalid vote details." });
  }

  const voterHash = hashVoter(voterId);
  const connection = await pool.getConnection();

  try {
    const [options] = await connection.execute(
      "SELECT id FROM options WHERE id = ? AND poll_id = ?",
      [optionId, pollId]
    );

    if (!options.length) {
      return res.status(400).json({ error: "Invalid battle option." });
    }

    await connection.execute(
      `INSERT INTO votes (poll_id, option_id, voter_hash)
       VALUES (?, ?, ?)`,
      [pollId, optionId, voterHash]
    );

    res.status(201).json({ success: true });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Already voted." });
    }

    console.error("Vote error:", error.message);
    res.status(500).json({ error: "Could not register vote." });
  } finally {
    connection.release();
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("MySQL connected successfully.");

    app.listen(PORT, () => {
      console.log(`WHO WINS? running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to MySQL:", error.message);
    process.exit(1);
  }
}

start();