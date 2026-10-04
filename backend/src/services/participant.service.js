import pool from "../config/database.js";

export async function findAllParticipants() {
  const query = `
    SELECT id, code, group_id, consent_confirmed, created_at
    FROM participants
    ORDER BY code
  `;

  const { rows } = await pool.query(query);

  return rows;
}

export async function findParticipantById(id) {
  const query = `
    SELECT id, code, group_id, consent_confirmed, consent_confirmed_at, created_at
    FROM participants
    WHERE id = $1
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] ?? null;
}

export async function findParticipantOnboardingById(id) {
  const query = `
    SELECT
      participants.id,
      participants.code,
      participants.consent_confirmed,
      participants.consent_confirmed_at,
      participant_profiles.id IS NOT NULL AS profile_completed
    FROM participants
    LEFT JOIN participant_profiles
      ON participant_profiles.participant_id = participants.id
    WHERE participants.id = $1
  `;

  const { rows } = await pool.query(query, [id]);
  const participant = rows[0];

  if (!participant) {
    return null;
  }

  return {
    participant: {
      id: participant.id,
      code: participant.code,
    },
    consent_confirmed: participant.consent_confirmed,
    consent_confirmed_at: participant.consent_confirmed_at,
    profile_completed: participant.profile_completed,
  };
}

export async function confirmParticipantConsentById(id) {
  const query = `
    UPDATE participants
    SET consent_confirmed = TRUE,
        consent_confirmed_at = COALESCE(consent_confirmed_at, CURRENT_TIMESTAMP)
    WHERE id = $1
    RETURNING consent_confirmed, consent_confirmed_at
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] ?? null;
}

export async function findExperimentGroupById(id) {
  const query = `
    SELECT id
    FROM experiment_groups
    WHERE id = $1
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] ?? null;
}

export async function createParticipant({
  code,
  group_id,
  consent_confirmed,
}) {
  const query = `
    INSERT INTO participants (code, group_id, consent_confirmed)
    VALUES ($1, $2, $3)
    RETURNING id, code, group_id, consent_confirmed, created_at
  `;

  const { rows } = await pool.query(query, [
    code,
    group_id,
    consent_confirmed,
  ]);

  return rows[0];
}

export async function updateParticipantById(
  id,
  { code, group_id, consent_confirmed },
) {
  const query = `
    UPDATE participants
    SET code = $1,
        group_id = $2,
        consent_confirmed = $3
    WHERE id = $4
    RETURNING id, code, group_id, consent_confirmed, created_at
  `;

  const { rows } = await pool.query(query, [
    code,
    group_id,
    consent_confirmed,
    id,
  ]);

  return rows[0] ?? null;
}

export async function deleteParticipantById(id) {
  const query = `
    DELETE FROM participants
    WHERE id = $1
    RETURNING id
  `;

  const { rows } = await pool.query(query, [id]);

  return rows[0] ?? null;
}
