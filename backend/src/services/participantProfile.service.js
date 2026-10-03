import pool from "../config/database.js";

export async function findParticipantProfileByParticipantId(participantId) {
  const query = `
    SELECT
      id,
      participant_id,
      course_period,
      software_dev_experience,
      software_testing_experience,
      test_case_experience,
      requirements_familiarity,
      genai_usage_frequency,
      genai_software_usage,
      genai_test_case_usage,
      created_at
    FROM participant_profiles
    WHERE participant_id = $1
  `;

  const { rows } = await pool.query(query, [participantId]);

  return rows[0] ?? null;
}

export async function createParticipantProfile(participantId, profile) {
  const query = `
    INSERT INTO participant_profiles (
      participant_id,
      course_period,
      software_dev_experience,
      software_testing_experience,
      test_case_experience,
      requirements_familiarity,
      genai_usage_frequency,
      genai_software_usage,
      genai_test_case_usage
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
      id,
      participant_id,
      course_period,
      software_dev_experience,
      software_testing_experience,
      test_case_experience,
      requirements_familiarity,
      genai_usage_frequency,
      genai_software_usage,
      genai_test_case_usage,
      created_at
  `;

  const { rows } = await pool.query(query, [
    participantId,
    profile.course_period,
    profile.software_dev_experience,
    profile.software_testing_experience,
    profile.test_case_experience,
    profile.requirements_familiarity,
    profile.genai_usage_frequency,
    profile.genai_software_usage,
    profile.genai_test_case_usage,
  ]);

  return rows[0];
}

export async function updateParticipantProfile(participantId, profile) {
  const query = `
    UPDATE participant_profiles
    SET course_period = $1,
        software_dev_experience = $2,
        software_testing_experience = $3,
        test_case_experience = $4,
        requirements_familiarity = $5,
        genai_usage_frequency = $6,
        genai_software_usage = $7,
        genai_test_case_usage = $8
    WHERE participant_id = $9
    RETURNING
      id,
      participant_id,
      course_period,
      software_dev_experience,
      software_testing_experience,
      test_case_experience,
      requirements_familiarity,
      genai_usage_frequency,
      genai_software_usage,
      genai_test_case_usage,
      created_at
  `;

  const { rows } = await pool.query(query, [
    profile.course_period,
    profile.software_dev_experience,
    profile.software_testing_experience,
    profile.test_case_experience,
    profile.requirements_familiarity,
    profile.genai_usage_frequency,
    profile.genai_software_usage,
    profile.genai_test_case_usage,
    participantId,
  ]);

  return rows[0] ?? null;
}
