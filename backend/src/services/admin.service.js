import pool from "../config/database.js";

export async function findParticipantsProgress() {
  const query = `
    SELECT
      participants.id,
      participants.code,
      experiment_groups.id AS group_id,
      experiment_groups.name AS group_name,
      participants.consent_confirmed,
      (participant_profiles.id IS NOT NULL) AS profile_completed,
      COUNT(experiment_tasks.id)::int AS tasks_total,
      COUNT(experiment_tasks.id) FILTER (
        WHERE experiment_tasks.status = 'PENDING'
      )::int AS tasks_pending,
      COUNT(experiment_tasks.id) FILTER (
        WHERE experiment_tasks.status = 'IN_PROGRESS'
      )::int AS tasks_in_progress,
      COUNT(experiment_tasks.id) FILTER (
        WHERE experiment_tasks.status = 'COMPLETED'
      )::int AS tasks_completed
    FROM participants
    INNER JOIN experiment_groups
      ON experiment_groups.id = participants.group_id
    LEFT JOIN participant_profiles
      ON participant_profiles.participant_id = participants.id
    LEFT JOIN experiment_tasks
      ON experiment_tasks.participant_id = participants.id
    GROUP BY
      participants.id,
      participants.code,
      experiment_groups.id,
      experiment_groups.name,
      participants.consent_confirmed,
      participant_profiles.id
    ORDER BY participants.code
  `;

  const { rows } = await pool.query(query);

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    group: {
      id: row.group_id,
      name: row.group_name,
    },
    consent_confirmed: row.consent_confirmed,
    profile_completed: row.profile_completed,
    tasks: {
      total: row.tasks_total,
      pending: row.tasks_pending,
      in_progress: row.tasks_in_progress,
      completed: row.tasks_completed,
    },
  }));
}
