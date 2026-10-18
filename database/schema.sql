-- ====================================================================
-- SkillNova - schema.sql
-- Creates the database and every table used by the backend.
-- Run with:  mysql -u root -p < database/schema.sql
-- ====================================================================

CREATE DATABASE IF NOT EXISTS skillnova
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE skillnova;

-- ---- Users & profiles -------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('student') NOT NULL DEFAULT 'student',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_roles (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id         INT UNSIGNED PRIMARY KEY,
  college         VARCHAR(150) NULL,
  degree          VARCHAR(100) NULL,
  graduation_year SMALLINT UNSIGNED NULL,
  target_role_id  INT UNSIGNED NULL,
  soft_skills     TEXT NULL,
  certifications  TEXT NULL,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_profile_role FOREIGN KEY (target_role_id)
    REFERENCES job_roles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---- Skills -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS skills (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(60) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS job_role_skills (
  job_role_id INT UNSIGNED NOT NULL,
  skill_id    INT UNSIGNED NOT NULL,
  importance  TINYINT UNSIGNED NOT NULL DEFAULT 3, -- 1 (low) .. 5 (critical)
  PRIMARY KEY (job_role_id, skill_id),
  CONSTRAINT fk_jrs_role  FOREIGN KEY (job_role_id) REFERENCES job_roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_jrs_skill FOREIGN KEY (skill_id)    REFERENCES skills(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_skills (
  user_id     INT UNSIGNED NOT NULL,
  skill_id    INT UNSIGNED NOT NULL,
  proficiency TINYINT UNSIGNED NOT NULL DEFAULT 0, -- 0..100
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, skill_id),
  CONSTRAINT fk_ss_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ss_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---- Roadmaps ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS roadmaps (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  job_role_id   INT UNSIGNED NOT NULL,
  title         VARCHAR(150) NOT NULL,
  source        ENUM('ai','fallback') NOT NULL DEFAULT 'fallback',
  duration_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  status        ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rm_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_rm_role FOREIGN KEY (job_role_id) REFERENCES job_roles(id) ON DELETE CASCADE,
  INDEX idx_rm_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roadmap_tasks (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  roadmap_id        INT UNSIGNED NOT NULL,
  day_number        SMALLINT UNSIGNED NOT NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT NULL,
  resources         TEXT NULL,          -- JSON array of {label,url}
  estimated_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  status            ENUM('pending','completed') NOT NULL DEFAULT 'pending',
  completed_at      TIMESTAMP NULL,
  CONSTRAINT fk_rt_roadmap FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  INDEX idx_rt_roadmap_day (roadmap_id, day_number)
) ENGINE=InnoDB;

-- ---- Resumes -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS resumes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,   -- random server-side filename
  size_bytes    INT UNSIGNED NOT NULL,
  uploaded_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_res_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resume_analyses (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resume_id       INT UNSIGNED NOT NULL,
  user_id         INT UNSIGNED NOT NULL,
  job_role_id     INT UNSIGNED NULL,
  score           TINYINT UNSIGNED NOT NULL,       -- 0..100 (documented method)
  score_breakdown TEXT NULL,                       -- JSON: per-criterion points
  strengths       TEXT NULL,                       -- JSON array
  weaknesses      TEXT NULL,                       -- JSON array
  missing_skills  TEXT NULL,                       -- JSON array
  suggestions     TEXT NULL,                       -- JSON array
  ai_feedback     TEXT NULL,                       -- Gemini text (NULL if fallback)
  source          ENUM('ai','fallback') NOT NULL DEFAULT 'fallback',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ra_resume FOREIGN KEY (resume_id)   REFERENCES resumes(id)   ON DELETE CASCADE,
  CONSTRAINT fk_ra_user   FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ra_role   FOREIGN KEY (job_role_id) REFERENCES job_roles(id) ON DELETE SET NULL,
  INDEX idx_ra_user (user_id, created_at)
) ENGINE=InnoDB;

-- ---- Mock interviews ----------------------------------------------------

CREATE TABLE IF NOT EXISTS interview_questions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_role_id INT UNSIGNED NULL,                  -- NULL = applies to all roles (e.g. HR)
  category    ENUM('technical','hr') NOT NULL,
  difficulty  ENUM('beginner','intermediate','advanced') NOT NULL,
  question    TEXT NOT NULL,
  key_points  TEXT NULL,                          -- JSON array of expected concepts
  CONSTRAINT fk_iq_role FOREIGN KEY (job_role_id) REFERENCES job_roles(id) ON DELETE CASCADE,
  INDEX idx_iq_filter (job_role_id, category, difficulty)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS interview_attempts (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  job_role_id INT UNSIGNED NULL,
  category    ENUM('technical','hr') NOT NULL,
  difficulty  ENUM('beginner','intermediate','advanced') NOT NULL,
  status      ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  total_score TINYINT UNSIGNED NULL,              -- 0..100, set when completed
  summary     TEXT NULL,
  started_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  CONSTRAINT fk_ia_user FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ia_role FOREIGN KEY (job_role_id) REFERENCES job_roles(id) ON DELETE SET NULL,
  INDEX idx_ia_user (user_id, started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS interview_answers (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id   INT UNSIGNED NOT NULL,
  question_id  INT UNSIGNED NOT NULL,
  answer_text  TEXT NOT NULL,
  score        TINYINT UNSIGNED NULL,             -- 0..100 per answer
  feedback     TEXT NULL,
  suggestions  TEXT NULL,                         -- JSON array
  model_answer TEXT NULL,                         -- example answer structure
  source       ENUM('ai','fallback') NOT NULL DEFAULT 'fallback',
  answered_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ians_attempt  FOREIGN KEY (attempt_id)  REFERENCES interview_attempts(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ians_question FOREIGN KEY (question_id) REFERENCES interview_questions(id) ON DELETE CASCADE,
  INDEX idx_ians_attempt (attempt_id)
) ENGINE=InnoDB;

-- ---- Activity log (streak + "My Progress" history) ----------------------

CREATE TABLE IF NOT EXISTS activity_log (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  activity_type ENUM('task_completed','resume_analyzed','interview_completed',
                     'roadmap_generated','profile_updated','login') NOT NULL,
  detail        VARCHAR(255) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_al_user_time (user_id, created_at)
) ENGINE=InnoDB;

