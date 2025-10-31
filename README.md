# DBMon - Database Monitor

A powerful real-time database monitoring tool for PostgreSQL, MariaDB, and SQL Server. Features health checks, uptime tracking, SSL control, and comprehensive CSV export capabilities for database administrators and DevOps teams.

## Features

- **Multi-database support**: PostgreSQL, MariaDB/MySQL, and SQL Server
- **Interactive CLI**: Select which servers to monitor
- **Real-time monitoring**: Continuous health checks with 1-second intervals
- **Colored output**: Clear visual indication of server status
- **Timing information**: Displays response times and error details
- **SSL control**: Option to require SSL per server configuration
- **Downtime tracking**: Shows multiple downtime periods with start/recovery times and total accumulated downtime
- **Session export**: CSV export of complete monitoring session with detailed metrics
- **Simple configuration**: Easy-to-edit JSON config file

## Installation

### Local Development

```bash
pnpm install
```

### Via NPX

```bash
npx dbmon
```

### Via NPM (after publishing)

```bash
npm install -g @underw8/dbmon
# or
pnpm add -g @underw8/dbmon
```

## First-Time Setup

On first run, if `config.json` doesn't exist, DBMon will offer to generate it from `config.json.example`:

```bash
npx @underw8/dbmon
# Will show security warning and prompt: "Would you like to generate config.json from the example? (y/N)"
```

After generation, edit `config.json` to match your database server configurations.

## Security Warning

⚠️ **IMPORTANT**: Database passwords are stored in plain text in the configuration file!

- Ensure `config.json` has proper file permissions (e.g., `chmod 600 config.json`)
- Never commit configuration files containing real passwords to version control
- Consider using environment variables or a secure credential store for production deployments
- The application will display security warnings when loading configuration files

## Configuration

Edit `config.json` to add your database servers:

```json
[
  {
    "name": "Production PostgreSQL",
    "type": "postgres",
    "host": "prod-db.example.com",
    "port": 5432,
    "database": "myapp",
    "username": "dbuser",
    "password": "secretpassword",
    "requireSSL": true,
    "disabled": false
  },
  {
    "name": "Local MariaDB",
    "type": "mariadb",
    "host": "localhost",
    "port": 3306,
    "database": "mysql",
    "username": "root",
    "password": "password",
    "requireSSL": false,
    "disabled": false
  },
  {
    "name": "Development SQL Server",
    "type": "sqlserver",
    "host": "sqlserver.company.com",
    "port": 1433,
    "database": "master",
    "username": "sa",
    "password": "Password123!",
    "requireSSL": false,
    "disabled": true
  }
]
```

### Supported Database Types

- `postgres` or `postgresql`: PostgreSQL databases
- `mariadb` or `mysql`: MariaDB/MySQL databases
- `sqlserver` or `mssql`: Microsoft SQL Server databases

### SSL Configuration

The `requireSSL` option controls SSL/TLS encryption for database connections:

- `true`: Requires SSL encryption with certificate validation
- `false` (default): SSL encryption is optional/disabled (useful for local development)

**Note**: Always use `requireSSL: true` in production environments for security.

### Server Disabling

The `disabled` option allows you to keep server configurations in the file while temporarily excluding them from the monitoring selection:

- `false` (default): Server appears in the selection menu and can be monitored
- `true`: Server is hidden from the selection menu but configuration is preserved

**Use cases**: Temporarily disable servers during maintenance, keep backup configurations, or exclude development servers from production monitoring.

## Usage

Start the application:

```bash
# Local installation
pnpm start

# Direct execution
node index.js

# Via npx (if published to npm)
npx @underw8/dbmon

# With custom config file
node index.js --config my-config.json
npx @underw8/dbmon --config /path/to/config.json

# Show help
node index.js --help
```

## Command Line Options

- `-c, --config <file>`: Specify a custom config file path (default: `config.json`)
- `-h, --help`: Show help message and usage information

The application will:

1. Check for `config.json` configuration file
2. If not found, offer to generate it from `config.json.example` (if available)
3. Load database servers from `config.json`
4. Present an interactive menu to select servers to monitor
5. Begin continuous monitoring with real-time updates
6. Display status, response times, and error messages

## Output

- **Green ✓**: Server is healthy and responding
- **Red ✗**: Server is down with error details
- **Yellow ?**: Unknown status or unsupported database type

Each server shows:

- **Response time**: Connection time in milliseconds
- **Timestamp**: When the last check was performed
- **Downtime information**: Shows current or last downtime period with start/end times and duration
- **Total downtime**: Accumulated downtime across all periods

**Downtime Display Examples:**

- **Currently UP**: `✓ 2:00:00 PM-2:05:00 PM (5m) | Total: 5m`
- **Currently DOWN**: `↓ 2:10:00 PM-NOW (2m 30s) | Total: 7m 30s`
- **Multiple periods**: `✓ 1:55:00 PM-2:00:00 PM (5m) | ✓ 2:00:00 PM-2:05:00 PM (5m) | ↓ 2:10:00 PM-NOW (2m 30s) | Total: 12m 30s`

Failed connections show the duration it took to determine the server was unreachable.

## Controls

- Use spacebar to select/deselect servers in the menu
- Press Enter to start monitoring
- Press Ctrl+C to exit the application

## CSV Export

When you exit the application (Ctrl+C), you'll be prompted to export the monitoring session data to a CSV file. The CSV contains:

- **timestamp**: ISO timestamp of each check
- **server_name**: Database server name
- **server_type**: Database type (postgres, mariadb, sqlserver)
- **status**: Check result (UP, DOWN, UNKNOWN)
- **response_time_ms**: Response time in milliseconds
- **error_message**: Error details (if any)
- **downtime_periods_json**: JSON array of all downtime periods for that server

**CSV Export Features:**

- Automatic filename generation: `dbmon_YYYY-MM-DD_HH-MM-SS.csv`
- Custom filename input with validation
- Complete session history export
- JSON-formatted downtime periods for detailed analysis
- Files automatically excluded from git commits

The CSV export is useful for:

- Long-term monitoring analysis
- Reporting and SLA tracking
- Performance trend analysis
- Incident investigation

## Publishing to NPM

This package includes automated publishing via GitHub Actions.

### Setup GitHub Secrets

1. Generate an NPM token:

   ```bash
   npm login
   # Follow the prompts to create an access token
   ```

2. Add `NPM_TOKEN` to your GitHub repository secrets:
   - Go to your repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your NPM access token

### Publishing Process

1. Update version in `package.json`
2. Commit and push changes
3. Create and push a version tag using semantic versioning:

   ```bash
   # For patch releases (bug fixes)
   git tag v1.0.1
   git push origin v1.0.1

   # For minor releases (new features)
   git tag v1.1.0
   git push origin v1.1.0

   # For major releases (breaking changes)
   git tag v2.0.0
   git push origin v2.0.0
   ```

The GitHub Action will automatically:

- Extract the version from the tag (e.g., `v1.1.0` → `1.1.0`)
- Update `package.json` with the correct version
- Publish to NPM with the tag-based version

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `pnpm start`
5. Submit a pull request

## Requirements

- Node.js 22.x or later
- Database credentials with SELECT privileges
- Network access to configured database servers

## Dependencies

- `pg`: PostgreSQL client
- `mysql2`: MySQL/MariaDB client
- `mssql`: SQL Server client
- `inquirer`: Interactive CLI prompts
- `chalk`: Terminal colors
