-- ====================================================================
-- SkillNova - seed.sql
-- Sample job roles, skills, role-skill mappings and interview questions.
-- Run AFTER schema.sql:  mysql -u root -p skillnova < database/seed.sql
-- Safe to re-run: uses INSERT IGNORE / unique keys.
-- ====================================================================
USE skillnova;

-- ---- Job roles ----
INSERT IGNORE INTO job_roles (id, name, description) VALUES
 (1,'Full Stack Developer','Builds both frontend and backend of web applications.'),
 (2,'Frontend Developer','Specializes in user interfaces with HTML, CSS and JavaScript.'),
 (3,'Backend Developer','Builds server-side APIs, databases and business logic.'),
 (4,'Data Analyst','Analyzes data with SQL, Python and visualization tools.'),
 (5,'Python Developer','Builds applications and automation using Python.');

-- ---- Skills ----
INSERT IGNORE INTO skills (id, name, category) VALUES
 (1,'HTML','Frontend'),(2,'CSS','Frontend'),(3,'JavaScript','Frontend'),
 (4,'React','Frontend'),(5,'Bootstrap','Frontend'),(6,'Responsive Design','Frontend'),
 (7,'Node.js','Backend'),(8,'Express.js','Backend'),(9,'REST APIs','Backend'),
 (10,'Authentication','Backend'),(11,'MySQL','Database'),(12,'SQL Joins','Database'),
 (13,'Database Design','Database'),(14,'Python','Programming'),(15,'Pandas','Data'),
 (16,'NumPy','Data'),(17,'Data Visualization','Data'),(18,'Excel','Data'),
 (19,'Statistics','Data'),(20,'Git','Tools'),(21,'Debugging','Tools'),
 (22,'Problem Solving','Core'),(23,'Data Structures','Core'),(24,'Algorithms','Core'),
 (25,'OOP','Core'),(26,'Testing','Tools'),(27,'Flask/Django Basics','Backend'),
 (28,'APIs & JSON','Backend'),(29,'Communication','Soft'),(30,'Teamwork','Soft');

-- ---- Role -> required skills (importance 1..5) ----
INSERT IGNORE INTO job_role_skills (job_role_id, skill_id, importance) VALUES
 -- Full Stack Developer
 (1,1,4),(1,2,4),(1,3,5),(1,4,4),(1,7,5),(1,8,5),(1,9,5),(1,10,4),(1,11,4),(1,12,3),(1,20,3),(1,23,3),
 -- Frontend Developer
 (2,1,5),(2,2,5),(2,3,5),(2,4,5),(2,5,3),(2,6,4),(2,9,3),(2,20,3),(2,21,3),
 -- Backend Developer
 (3,7,5),(3,8,5),(3,9,5),(3,10,5),(3,11,5),(3,12,4),(3,13,4),(3,14,3),(3,20,3),(3,23,4),(3,24,4),
 -- Data Analyst
 (4,11,5),(4,12,5),(4,14,5),(4,15,5),(4,16,4),(4,17,5),(4,18,4),(4,19,5),(4,22,3),
 -- Python Developer
 (5,14,5),(5,25,5),(5,23,4),(5,24,4),(5,27,4),(5,28,4),(5,11,3),(5,20,3),(5,26,3);

-- ---- Interview question bank ----
-- HR questions (job_role_id NULL = usable for every role)
INSERT IGNORE INTO interview_questions (id, job_role_id, category, difficulty, question, key_points) VALUES
 (1,NULL,'hr','beginner','Tell me about yourself and your background.','["education","projects","skills","career goal"]'),
 (2,NULL,'hr','beginner','What are your greatest strengths and how have you used them?','["strength","example","result"]'),
 (3,NULL,'hr','beginner','Why do you want to work in this role?','["interest","skills match","career goal"]'),
 (4,NULL,'hr','intermediate','Describe a challenge you faced in a project and how you handled it.','["situation","action","result","learning"]'),
 (5,NULL,'hr','intermediate','Tell me about a time you worked in a team and faced a disagreement.','["teamwork","communication","resolution"]'),
 (6,NULL,'hr','advanced','Where do you see yourself in five years, and how does this role fit that plan?','["career plan","growth","realistic goals"]'),
 (7,NULL,'hr','advanced','Describe a time you failed. What did you learn and change afterwards?','["honesty","learning","improvement","example"]'),

-- Full Stack Developer (role 1)
 (10,1,'technical','beginner','What is the difference between HTML, CSS and JavaScript in a web page?','["structure","styling","behaviour","browser"]'),
 (11,1,'technical','beginner','What is an API and why do web applications use them?','["interface","request","response","JSON","client server"]'),
 (12,1,'technical','intermediate','Explain how a REST API works, including common HTTP methods.','["GET","POST","PUT","DELETE","endpoints","status codes"]'),
 (13,1,'technical','intermediate','How would you store and verify user passwords securely?','["hashing","bcrypt","salt","never plain text"]'),
 (14,1,'technical','advanced','How would you design authentication and sessions for a multi-page web app?','["session","cookie","token","middleware","expiry","security"]'),
 (15,1,'technical','advanced','How do you prevent SQL injection and XSS in a full stack application?','["parameterized queries","escaping","validation","sanitize"]'),

-- Frontend Developer (role 2)
 (20,2,'technical','beginner','What is the CSS box model?','["content","padding","border","margin"]'),
 (21,2,'technical','beginner','What is the difference between var, let and const in JavaScript?','["scope","hoisting","reassignment","block"]'),
 (22,2,'technical','intermediate','Explain how flexbox helps build responsive layouts.','["container","items","axis","wrap","media queries"]'),
 (23,2,'technical','intermediate','What happens when a browser loads a web page?','["HTML parsing","DOM","CSSOM","render","JavaScript"]'),
 (24,2,'technical','advanced','How would you improve the performance of a slow web page?','["minify","lazy loading","caching","images","bundle size"]'),
 (25,2,'technical','advanced','Explain event delegation and why it is useful.','["bubbling","listener","parent","performance"]'),

-- Backend Developer (role 3)
 (30,3,'technical','beginner','What is a database primary key and a foreign key?','["unique","identifier","relationship","referential integrity"]'),
 (31,3,'technical','beginner','What is the difference between SQL WHERE and HAVING?','["rows","groups","aggregate","filter"]'),
 (32,3,'technical','intermediate','Explain middleware in Express.js with an example.','["request","response","next","chain","authentication"]'),
 (33,3,'technical','intermediate','What is an SQL JOIN? Describe INNER and LEFT JOIN.','["combine tables","matching rows","null","relationship"]'),
 (34,3,'technical','advanced','How would you design a schema for students, courses and enrollments?','["tables","foreign keys","many to many","junction table"]'),
 (35,3,'technical','advanced','How do transactions keep data consistent? Explain ACID briefly.','["atomicity","consistency","isolation","durability","rollback"]'),

-- Data Analyst (role 4)
 (40,4,'technical','beginner','What is the difference between mean, median and mode?','["average","middle value","most frequent","outliers"]'),
 (41,4,'technical','beginner','What is SQL used for in data analysis?','["query","filter","aggregate","join","reporting"]'),
 (42,4,'technical','intermediate','How would you handle missing values in a dataset?','["drop","impute","mean","context","pandas"]'),
 (43,4,'technical','intermediate','Explain GROUP BY with an example query.','["aggregate","count","sum","grouping column"]'),
 (44,4,'technical','advanced','How would you present an analysis to non-technical stakeholders?','["visualization","story","insight","recommendation","simple language"]'),
 (45,4,'technical','advanced','Explain correlation versus causation with an example.','["relationship","cause","confounding","experiment"]'),

-- Python Developer (role 5)
 (50,5,'technical','beginner','What is the difference between a list and a tuple in Python?','["mutable","immutable","syntax","use cases"]'),
 (51,5,'technical','beginner','What are Python dictionaries and when do you use them?','["key value","lookup","hash","mutable"]'),
 (52,5,'technical','intermediate','Explain list comprehensions with an example.','["syntax","loop","condition","readable"]'),
 (53,5,'technical','intermediate','What is exception handling in Python? Describe try/except/finally.','["try","except","finally","raise","error types"]'),
 (54,5,'technical','advanced','Explain decorators in Python and give a use case.','["function wrapper","@syntax","closures","logging","reuse"]'),
 (55,5,'technical','advanced','How does Python manage memory and garbage collection?','["reference counting","garbage collector","del","cycles"]');

