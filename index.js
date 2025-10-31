#!/usr/bin/env node

import fs from "fs";
import path from "path";
import readline from "readline";
import inquirer from "inquirer";
import chalk from "chalk";
import { performHealthCheck } from "./database.js";

const CONFIG_FILE = "config.json";

async function loadConfig() {
  try {
    const configData = fs.readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(configData);
  } catch (error) {
    // Check if config.json doesn't exist but config.json.example does
    if (error.code === "ENOENT") {
      const exampleConfigFile = "config.json.example";
      try {
        await fs.promises.access(exampleConfigFile);
        // config.json.example exists, offer to copy it
        console.log(
          chalk.yellow(`Configuration file '${CONFIG_FILE}' not found.`)
        );
        console.log(
          chalk.blue(
            `Found '${exampleConfigFile}' - this contains sample configuration.`
          )
        );

        const answers = await inquirer.prompt([
          {
            type: "confirm",
            name: "generateConfig",
            message: "Would you like to generate config.json from the example?",
            default: true,
          },
        ]);

        if (answers.generateConfig) {
          const exampleData = await fs.promises.readFile(
            exampleConfigFile,
            "utf8"
          );
          await fs.promises.writeFile(CONFIG_FILE, exampleData);
          console.log(
            chalk.green(`✓ Generated ${CONFIG_FILE} from ${exampleConfigFile}`)
          );
          console.log(
            chalk.blue(
              "You can now edit config.json to customize your database connections."
            )
          );
          return JSON.parse(exampleData);
        } else {
          console.log(
            chalk.yellow(
              "Please create config.json manually or run this command again to generate it."
            )
          );
          process.exit(0);
        }
      } catch (exampleError) {
        // Neither config.json nor config.json.example exists
        console.error(
          chalk.red(`Configuration file '${CONFIG_FILE}' not found.`)
        );
        console.error(
          chalk.yellow(
            "Please create config.json with your database server configurations."
          )
        );
        console.error(chalk.gray("Example configuration format:"));
        console.error(
          chalk.gray(`[
  {
    "name": "My Database",
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "username": "user",
    "password": "password",
    "requireSSL": false,
    "disabled": false
  }
]`)
        );
        process.exit(1);
      }
    } else {
      // config.json exists but has parsing error
      console.error(chalk.red(`Error loading config file: ${error.message}`));
      console.error(
        chalk.yellow(`Make sure ${CONFIG_FILE} exists and is valid JSON`)
      );
      process.exit(1);
    }
  }
}

function displayResults(servers, results, serverStates) {
  console.clear();
  console.log(chalk.bold.blue("DBMon - Database Monitor"));
  console.log(chalk.gray("=".repeat(70)));
  console.log();

  servers.forEach((server, index) => {
    const result = results[index];
    const state = serverStates[index];
    const timestamp = new Date().toLocaleTimeString();

    const downtimeInfo = getDowntimeInfo(state.downtimePeriods);

    if (result.status === "UP") {
      console.log(
        chalk.green(
          `✓ ${server.name} (${server.type}) - ${result.duration}ms [${timestamp}]`
        )
      );
      console.log(chalk.gray(`  ${downtimeInfo}`));
    } else if (result.status === "DOWN") {
      console.log(
        chalk.red(
          `✗ ${server.name} (${server.type}) - DOWN (${result.duration}ms) [${timestamp}]`
        )
      );
      console.log(chalk.red(`  Error: ${result.error}`));
      console.log(chalk.gray(`  ${downtimeInfo}`));
    } else {
      console.log(
        chalk.yellow(
          `? ${server.name} (${server.type}) - ${result.status} [${timestamp}]`
        )
      );
      if (result.error) {
        console.log(chalk.yellow(`  Error: ${result.error}`));
      }
      console.log(chalk.gray(`  ${downtimeInfo}`));
    }
  });

  console.log();
  console.log(chalk.gray("Press Ctrl+C to exit"));
}

function formatDuration(ms) {
  if (ms === 0) return "0s";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getDowntimeInfo(downtimePeriods) {
  if (!downtimePeriods || downtimePeriods.length === 0) {
    return "Total downtime: 0s";
  }

  // Calculate total downtime
  let totalDowntime = 0;
  const completedPeriods = downtimePeriods.filter((period) => period.endTime);
  const currentDowntime = downtimePeriods.find((period) => !period.endTime);

  completedPeriods.forEach((period) => {
    totalDowntime += period.endTime - period.startTime;
  });

  if (currentDowntime) {
    totalDowntime += Date.now() - currentDowntime.startTime;
  }

  const totalDowntimeStr = formatDuration(totalDowntime);

  // Show last 3 periods
  const periodsToShow = [];
  const allPeriods = [...completedPeriods];
  if (currentDowntime) {
    allPeriods.push({
      ...currentDowntime,
      endTime: Date.now(),
      isCurrent: true,
    });
  }

  const recentPeriods = allPeriods.slice(-3);

  recentPeriods.forEach((period, index) => {
    const startTime = new Date(period.startTime).toLocaleTimeString();
    const endTime = period.endTime
      ? new Date(period.endTime).toLocaleTimeString()
      : "NOW";
    const duration = formatDuration(period.endTime - period.startTime);
    const prefix = period.isCurrent ? "↓" : "✓";

    periodsToShow.push(`${prefix} ${startTime}-${endTime} (${duration})`);
  });

  const periodsStr = periodsToShow.join(" | ");
  return `${periodsStr} | Total: ${totalDowntimeStr}`;
}

function exportToCSV(sessionData, filename) {
  const headers = [
    "timestamp",
    "server_name",
    "server_type",
    "status",
    "response_time_ms",
    "error_message",
    "downtime_periods_json",
  ];

  const csvRows = [headers.join(",")];

  sessionData.forEach((entry) => {
    const row = [
      new Date(entry.timestamp).toISOString(),
      `"${entry.serverName}"`,
      entry.serverType,
      entry.status,
      entry.responseTime,
      `"${entry.errorMessage || ""}"`,
      `"${JSON.stringify(entry.downtimePeriods || [])}"`,
    ];
    csvRows.push(row.join(","));
  });

  const csvContent = csvRows.join("\n");
  fs.writeFileSync(filename, csvContent, "utf8");
  console.log(chalk.green(`Session data exported to: ${filename}`));
}

async function promptForCSVExport(sessionData) {
  if (sessionData.length === 0) {
    return;
  }

  // Use a simple readline interface instead of inquirer to avoid SIGINT conflicts
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      "Would you like to export the monitoring session to CSV? (y/N): ",
      (answer) => {
        rl.close();

        const shouldExport = answer.toLowerCase().startsWith("y");

        if (shouldExport) {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
          const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-"); // HH-MM-SS
          const defaultFilename = `dbmon_${dateStr}_${timeStr}.csv`;

          // For simplicity, just use the default filename
          // In a more advanced version, we could prompt for custom filename too
          try {
            exportToCSV(sessionData, defaultFilename);
          } catch (error) {
            console.error(chalk.red(`Failed to export CSV: ${error.message}`));
          }
        }

        resolve();
      }
    );

    // Handle Ctrl+C during readline
    rl.on("SIGINT", () => {
      rl.close();
      console.log(chalk.gray("\nCSV export cancelled."));
      resolve();
    });
  });
}

async function monitorServers(servers, serverStates, sessionData) {
  const startCheckTime = Date.now();

  const results = await Promise.all(
    servers.map((server) => performHealthCheck(server))
  );

  const checkDuration = Date.now() - startCheckTime;

  // Record session data
  results.forEach((result, index) => {
    const server = servers[index];
    sessionData.push({
      timestamp: Date.now(),
      serverName: server.name,
      serverType: server.type,
      status: result.status,
      responseTime: result.duration,
      errorMessage: result.error,
      downtimePeriods: JSON.parse(
        JSON.stringify(serverStates[index].downtimePeriods || [])
      ),
    });
  });

  // Update server states
  results.forEach((result, index) => {
    const state = serverStates[index];
    const previousStatus = state.currentStatus;

    state.currentStatus = result.status;

    // Initialize downtimePeriods if it doesn't exist
    if (!state.downtimePeriods) {
      state.downtimePeriods = [];
    }

    if (result.status === "UP" && previousStatus === "DOWN") {
      // Server just came back up - end the current downtime period
      const currentPeriod = state.downtimePeriods.find(
        (period) => !period.endTime
      );
      if (currentPeriod) {
        currentPeriod.endTime = Date.now();
      }
    } else if (result.status === "DOWN" && previousStatus !== "DOWN") {
      // Server just went down - start a new downtime period
      state.downtimePeriods.push({
        startTime: Date.now(),
        endTime: null,
      });
    }
    // If server stays UP or stays DOWN, no action needed
  });

  displayResults(servers, results, serverStates);

  // Schedule next check in 1 second (unless shutting down)
  if (!isShuttingDown) {
    setTimeout(
      () => monitorServers(servers, serverStates, sessionData),
      1000 - checkDuration
    );
  }
}

let isShuttingDown = false;

async function main() {
  console.log(chalk.bold.blue("DBMon - Database Monitor"));
  console.log();

  const config = await loadConfig();

  if (config.length === 0) {
    console.log(
      chalk.yellow(
        "No database servers configured. Please add servers to config.json"
      )
    );
    process.exit(0);
  }

  // Filter out disabled servers and create choices with original indices
  const enabledServers = config
    .map((server, index) => ({ server, originalIndex: index }))
    .filter(({ server }) => !server.disabled);

  const choices = enabledServers.map(({ server, originalIndex }) => ({
    name: `${server.name} (${server.type}) - ${server.host}:${server.port}`,
    value: originalIndex,
    short: server.name,
  }));

  let answers;
  try {
    answers = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedServers",
        message: "Select database servers to monitor:",
        choices: choices,
        validate: (answer) => {
          if (answer.length === 0) {
            return "Please select at least one server to monitor.";
          }
          return true;
        },
      },
    ]);
  } catch (error) {
    if (error.name === "ExitPromptError") {
      console.log(chalk.gray("\nServer selection cancelled."));
      process.exit(0);
    }
    throw error;
  }

  const selectedServers = answers.selectedServers.map((index) => config[index]);

  // Initialize server states and session data
  const serverStates = selectedServers.map(() => ({
    currentStatus: null,
    downtimePeriods: [],
  }));
  const sessionData = [];

  console.log(
    chalk.green(
      `\nStarting monitoring for ${selectedServers.length} server(s)...\n`
    )
  );

  // Handle graceful shutdown
  let shutdownStartTime = 0;
  const shutdownHandler = async () => {
    const now = Date.now();

    if (isShuttingDown) {
      // If shutdown has been going on for more than 2 seconds, force exit
      if (now - shutdownStartTime > 2000) {
        console.log(chalk.red("\nForce exiting..."));
        process.exit(1);
      }
      // Otherwise, ignore additional SIGINT signals during shutdown
      return;
    }

    isShuttingDown = true;
    shutdownStartTime = now;
    console.log(chalk.yellow("\nStopping DBMon..."));

    // Small delay to allow any pending SIGINT signals to clear
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      await promptForCSVExport(sessionData);
    } catch (error) {
      console.error(chalk.red("Error during shutdown:"), error.message);
    }

    process.exit(0);
  };

  process.on("SIGINT", shutdownHandler);

  // Start monitoring
  await monitorServers(selectedServers, serverStates, sessionData);
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error(chalk.red("Unhandled error:"), error);
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red("Application error:"), error);
  process.exit(1);
});
