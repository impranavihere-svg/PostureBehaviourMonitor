# Posture Behaviour Monitor API

Spring Boot 3 / Java 17+ REST API for persisting posture monitoring sessions and deviation events in MySQL with Gemini-powered session insights.

## Requirements
- JDK 17+ or JDK 21+
- MySQL 8+ (e.g., local Windows MySQL80 service)
- Maven Wrapper is included (`mvnw` / `mvnw.cmd`)

## Configuration
Set environment variables in your terminal or shell before running:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DB_URL` | JDBC URL for MySQL | `jdbc:mysql://localhost:3306/posture_monitor?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC` |
| `DB_USERNAME` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | `""` (empty) |
| `GEMINI_API_KEY` | Google Gemini API Key | `""` (rule-based fallback when empty) |
| `GEMINI_MODEL` | Gemini Model Identifier | `gemini-1.5-flash` |
| `PORT` | API server port | `8080` |

> [!NOTE]
> Never place real API keys or database passwords in frontend code, Git commits, or documentation.

## Run with Maven Wrapper

### Windows (PowerShell):
```powershell
# Set JAVA_HOME if not already pointing to JDK 17/21:
$env:JAVA_HOME = "C:\Users\prana\.vscode\extensions\redhat.java-1.56.0-win32-x64\jre\21.0.12.1-win32-x86_64"

# Set your MySQL password:
$env:DB_PASSWORD = "your_mysql_password"

# Optional: set Gemini API key from Google AI Studio:
$env:GEMINI_API_KEY = "your_gemini_api_key"

# Run Spring Boot:
.\mvnw.cmd spring-boot:run
```

### Linux / macOS:
```bash
export DB_PASSWORD="your_mysql_password"
export GEMINI_API_KEY="your_gemini_api_key"
./mvnw spring-boot:run
```

## Running Automated Tests
The backend test suite uses an in-memory H2 database, requiring no live MySQL connection:
```powershell
.\mvnw.cmd test
```

## REST API Endpoints
- `GET /api/health` — Verifies service health
- `POST /api/sessions` — Persists completed monitoring session and deviation events
- `GET /api/sessions` — Retrieves historical sessions ordered by `startedAt DESC`
- `GET /api/sessions/{id}` — Retrieves session details and child events
- `GET /api/sessions/{id}/insights` — Returns AI-generated or rule-based session reflection

