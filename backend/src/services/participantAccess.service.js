import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../config/database.js";
import { sendParticipantAccessEmail } from "./email.service.js";

const ACCESS_CODE_LENGTH = 8;
const ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_SALT_ROUNDS = 12;
const GROUP_ASSIGNMENT_LOCK_ID = 2026100301;

function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function normalizeEmail(email) {
  return email?.trim().toLowerCase() || "";
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function generateAccessCode() {
  let code = "";

  for (let index = 0; index < ACCESS_CODE_LENGTH; index += 1) {
    const randomIndex = crypto.randomInt(0, ACCESS_CODE_ALPHABET.length);

    code += ACCESS_CODE_ALPHABET[randomIndex];
  }

  return code;
}

async function hashAccessCode(accessCode) {
  return bcrypt.hash(accessCode, ACCESS_CODE_SALT_ROUNDS);
}

async function markAccessEmailSent(participantId) {
  await pool.query(
    `
      UPDATE participant_access
      SET last_sent_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE participant_id = $1
    `,
    [participantId],
  );
}

async function sendAccessEmailAfterCommit({ participantId, email, accessCode }) {
  try {
    await sendParticipantAccessEmail({ email, accessCode });
    await markAccessEmailSent(participantId);

    return true;
  } catch (error) {
    console.error("Falha ao enviar e-mail de acesso:", error.message);
    return false;
  }
}

export async function createParticipantAccess({ email }) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    throw createServiceError(400, "E-mail invalido.");
  }

  const accessCode = generateAccessCode();
  const accessCodeHash = await hashAccessCode(accessCode);
  const client = await pool.connect();
  let createdParticipant;
  let selectedGroup;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      GROUP_ASSIGNMENT_LOCK_ID,
    ]);

    const existingAccessResult = await client.query(
      `
        SELECT id
        FROM participant_access
        WHERE LOWER(email) = LOWER($1)
      `,
      [normalizedEmail],
    );

    if (existingAccessResult.rows[0]) {
      throw createServiceError(409, "Ja existe participante com este e-mail.");
    }

    const codeResult = await client.query(
      "SELECT nextval('participant_code_seq')::int AS next_code",
    );
    const participantCode = `P${String(codeResult.rows[0].next_code).padStart(
      2,
      "0",
    )}`;

    const groupResult = await client.query(
      `
        SELECT experiment_groups.id, experiment_groups.name, COUNT(participants.id)::int AS total
        FROM experiment_groups
        LEFT JOIN participants
          ON participants.group_id = experiment_groups.id
        WHERE experiment_groups.name IN ('Grupo 1', 'Grupo 2', 'Grupo 3')
        GROUP BY experiment_groups.id, experiment_groups.name
        ORDER BY total ASC, RANDOM()
        LIMIT 1
      `,
    );
    selectedGroup = groupResult.rows[0];

    if (!selectedGroup) {
      throw createServiceError(400, "Nenhum grupo experimental configurado.");
    }

    const participantResult = await client.query(
      `
        INSERT INTO participants (code, group_id, consent_confirmed)
        VALUES ($1, $2, FALSE)
        RETURNING id, code, group_id, consent_confirmed, created_at
      `,
      [participantCode, selectedGroup.id],
    );
    createdParticipant = participantResult.rows[0];

    await client.query(
      `
        INSERT INTO participant_access (
          participant_id,
          email,
          access_code_hash,
          access_code_created_at
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `,
      [createdParticipant.id, normalizedEmail, accessCodeHash],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createServiceError(409, "Ja existe participante com este e-mail.");
    }

    throw error;
  } finally {
    client.release();
  }

  const emailSent = await sendAccessEmailAfterCommit({
    participantId: createdParticipant.id,
    email: normalizedEmail,
    accessCode,
  });

  return {
    id: createdParticipant.id,
    code: createdParticipant.code,
    email: normalizedEmail,
    group: {
      id: selectedGroup.id,
      name: selectedGroup.name,
    },
    email_sent: emailSent,
  };
}
