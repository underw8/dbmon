import pg from "pg";
import mysql from "mysql2/promise";
import sql from "mssql";

export async function healthCheckPostgres(config) {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    connectionTimeoutMillis: 5000, // 5 second timeout
    ssl: config.requireSSL ? { rejectUnauthorized: false } : false,
  });

  const startTime = Date.now();

  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return {
      status: "UP",
      duration: Date.now() - startTime,
      error: null,
    };
  } catch (error) {
    try {
      await client.end();
    } catch (e) {
      // Ignore connection end errors
    }
    return {
      status: "DOWN",
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

export async function healthCheckMariaDB(config) {
  const startTime = Date.now();

  try {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      connectTimeout: 5000, // 5 second timeout
      ssl: config.requireSSL ? undefined : "disabled",
    });

    await connection.execute("SELECT 1");
    await connection.end();
    return {
      status: "UP",
      duration: Date.now() - startTime,
      error: null,
    };
  } catch (error) {
    return {
      status: "DOWN",
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

export async function healthCheckSQLServer(config) {
  const startTime = Date.now();

  try {
    const pool = await sql.connect({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      connectionTimeout: 5000, // 5 second timeout
      requestTimeout: 5000,
      options: {
        encrypt: config.requireSSL ? true : false,
        trustServerCertificate: config.requireSSL ? true : false,
      },
    });

    await pool.request().query("SELECT 1");
    await pool.close();
    return {
      status: "UP",
      duration: Date.now() - startTime,
      error: null,
    };
  } catch (error) {
    return {
      status: "DOWN",
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

export async function performHealthCheck(server) {
  switch (server.type.toLowerCase()) {
    case "postgres":
    case "postgresql":
      return await healthCheckPostgres(server);
    case "mariadb":
    case "mysql":
      return await healthCheckMariaDB(server);
    case "sqlserver":
    case "mssql":
      return await healthCheckSQLServer(server);
    default:
      return {
        status: "UNKNOWN",
        duration: 0,
        error: `Unsupported database type: ${server.type}`,
      };
  }
}
