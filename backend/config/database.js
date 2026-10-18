// ====================================================================
// SkillNova - config/database.js
// One shared MySQL connection pool for the whole backend.
//
// - Reads credentials from .env (never hardcoded).
// - pool.execute(sql, params) always uses PARAMETERIZED queries,
//   which prevents SQL injection.
// - isDbConfigured() lets routes give a clear error message instead
//   of crashing when .env still has placeholder values.
// ====================================================================

const mysql = require("mysql2/promise");

const PLACEHOLDER_PASSWORD = "your_mysql_password_here";

function isDbConfigured() {
    return (
        Boolean(process.env.DB_PASSWORD) &&
        process.env.DB_PASSWORD !== PLACEHOLDER_PASSWORD
    );
}

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "skillnova",
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: false,
});

// Quick startup check so problems show in the terminal immediately.
async function testConnection() {
    if (!isDbConfigured()) {
        console.warn(
            "[DB] Not configured yet - set DB_PASSWORD in .env. " +
            "APIs that need the database will return 503."
        );
        return false;
    }
    try {
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        console.log("[DB] Connected to MySQL database:", process.env.DB_NAME);
        return true;
    } catch (error) {
        console.error("[DB] Connection failed:", error.message);
        return false;
    }
}

module.exports = { pool, isDbConfigured, testConnection };
