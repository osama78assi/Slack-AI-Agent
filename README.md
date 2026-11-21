# Slack AI Lead Analyzer

An AI-powered Slack agent that analyzes new community members, researches their professional backgrounds, and evaluates how well they fit your company's target audience.

The agent uses LangChain and an LLM to gather insights, assign a fitness score out of 10, explain the reasoning behind that score, and recommend potential engagement opportunities.

## How It Works

1. **Member joins Slack:** The agent listens for new member events across accessible Slack channels.
2. **Information gathering:** Collects available information such as name, email, and job title.
3. **Background research:** Searches for publicly available professional information, including current employment and GitHub profiles when relevant.
4. **AI analysis:** Evaluates the collected information against your company's product and target audience.
5. **Scoring and recommendations:** Generates a fitness score out of 10, explains the factors behind the score, and suggests relevant engagement opportunities.
6. **Reporting:** Saves the analysis in PostgreSQL and sends the results to a pre-configured Slack channel.

## Scoring

The fitness score represents how closely a member's background aligns with your company's target audience.

The analysis considers factors such as:

- **Professional background:** Their current role and experience.
- **Company affiliation:** Whether their employer represents a relevant potential customer or partner.
- **Technical background:** Relevant programming skills, technologies, and GitHub activity.
- **Product relevance:** How their background relates to your company's product.

The agent doesn't just provide a score; it explains why the person received it, identifies relevant findings, and provides recommendations based on their background.

Scores are AI-generated estimates, not definitive assessments of purchasing intent or customer suitability.

## Tech Stack

- **Node.js & JavaScript**
- **LangChain**
- **OpenAI API / Compatible Providers**
- **Slack API (Socket Mode / WebSocket)**
- **PostgreSQL**

## Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL
- A Slack workspace with permission to create applications
- An OpenAI API key or compatible provider credentials

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/slack-ai-lead-analyzer.git
cd slack-ai-lead-analyzer
npm install
```

### 2. Configure environment variables

Create a `.env` file using `.env.example` as a reference:

```env
# Database
DATABASE_CONNECTION_STRING=

# Slack
SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
SLACK_SIGNING_SECRET=
SLACK_PRIVATE_CHANNEL_ID=

# AI Provider
OPENAI_API_KEY=
OPENAI_BASE_URL=

# Company Information
COMPANY_NAME=
COMPANY_PRODUCT=

# Application
PORT=
NODE_ENV=
```

`OPENAI_BASE_URL` is optional and allows using alternative OpenAI-compatible API providers.

### 3. Configure PostgreSQL

Create a database and provide its connection string through `DATABASE_CONNECTION_STRING`. Run any required database initialization or migration commands.

### 4. Configure Slack

Create an application through the [Slack API dashboard](https://api.slack.com/apps).

Configure the following:

- Enable Socket Mode and generate an App-Level Token.
- Configure the bot token and signing secret.
- Enable the required bot event subscriptions, including member-join events.
- Grant the necessary OAuth scopes.
- Install the application into your workspace.
- Invite the bot to the channel where it should publish analysis reports.

**Note:** The current implementation monitors all channels the application has access to. Restricting monitoring to specific channels requires customizing the event-handling logic.

### 5. Run the application

```bash
npm run dev
```

There is no separate build step. To switch between development and production environments, change `NODE_ENV` in your `.env` file:

```env
NODE_ENV=development
```

## Testing

The project includes a test endpoint to trigger an analysis manually without waiting for a Slack event.

**Endpoint:**

```http
POST /test/analyze-memeber
```

**Example request:**

```json
{
  "email": "john.doe@company.com",
  "title": "Software Engineer",
  "name": "John Doe"
}
```

## Database Reliability

PostgreSQL acts as the source of truth for analysis records.

If an analysis succeeds but sending the Slack message fails, the results remain stored in the database and can still be retrieved.

## Limitations

- Research quality depends on publicly available information.
- Members with limited online presence may receive less comprehensive analysis.
- AI-generated scores and recommendations may contain inaccuracies.
- Professional background does not necessarily indicate purchasing intent.

## Future Improvements

- More background research sources.
- Configurable audience profiles and scoring criteria.
- Retry mechanisms for failed analysis and Slack delivery.
- Dashboard for browsing and managing analyzed members.
- Engagement and conversion tracking.

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Osama Assi