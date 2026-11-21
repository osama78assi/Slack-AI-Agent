import pkg from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { ChatOpenAI } from "@langchain/openai";

// To build a prompts with variable placeholders
import { ChatPromptTemplate } from "@langchain/core/prompts";
import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import log from "./util.js";
import { closeDatabase, connectDB, saveMemberAnalysis } from "./db.js";

dotenv.config();

const { App } = pkg;

class SlackAIAgent {
    constructor() {
        this.app = express();

        // Create a Slack bolt app instance using socket so no public URL needed
        this.slack = new App({
            token: process.env.SLACK_BOT_TOKEN,
            signingSecret: process.env.SLACK_SIGNING_SECRET,

            // Use websocket instead of HTTP
            socketMode: true,
            appToken: process.env.SLACK_APP_TOKEN,
        });

        // Create a client
        this.webClient = new WebClient(process.env.SLACK_BOT_TOKEN);

        // Create the chat and select the model
        this.openai = new ChatOpenAI({
            model: "gpt-5.6-luna",
            temperature: 0.3,
            apiKey: process.env.OPENAI_API_KEY,
            ...(process.env.OPENAI_BASE_URL
                ? {
                      configuration: {
                          baseUR: process.env.OPENAI_BASE_URL,
                      },
                  }
                : {}),
        });

        this.setupSlackEvents();
        this.setupExpress();
    }

    setupSlackEvents() {
        // Setting a listener when someone joins your team
        this.slack.event("team_join", async ({ event }) => {
            try {
                log.info(
                    `New memeber joined: ${event.user.real_name || event.user.name}`,
                );

                const userInfo = await this.getUserInfo(event.user.id);
                await this.analyzeAndPostMember(userInfo);
            } catch (err) {
                log.error(`Error processing team_join: `, err.message);
            }
        });

        // Setting a listener when someone joins a channel
        this.slack.event("member_joined_channel", async ({ event }) => {
            try {
                // We will only process the public channels
                if (event.channel_type !== "C") {
                    return;
                }

                log.info(
                    `Member: ${event.user} joined channel ${event.channel}`,
                );
                const userInfo = await this.getUserInfo(event.user.id);
                await this.analyzeAndPostMember(userInfo);
            } catch (err) {
                log.error(
                    `Error member_joined_channel team_join: `,
                    err.message,
                );
            }
        });

        // Setting up an error handler middleware for slack app
        this.slack.error(async (err) =>
            log.error("Slack error: ", err.message),
        );
    }

    setupExpress() {
        this.app.use(express.json());

        this.app.get("/health", (req, res) => {
            res.json({
                status: "Healthy",
                timestamp: new Date().toISOString(),
            });
        });

        // Error handler middleware
        this.app.use((err, req, res, next) => {
            log.error(`Express error`, err.message);
            res.status(500).json({
                error: "Internal server error",
            });
        });

        // Expose only testing endpoints in case of testing
        if (process.env.NODE_ENV === "development") {
            this.app.post("/test/analyze-memeber", async (req, res) => {
                try {
                    const { memberInfo } = req.body ?? {};

                    if (!memberInfo) {
                        return res.status(400).json({
                            error: "memberInfo is required",
                        });
                    }

                    const analysis =
                        await this.analyzeAndPostMember(memberInfo);

                    res.json({
                        success: true,
                        analysis,
                        timestamp: new Date().toISOString(),
                    });
                } catch (err) {
                    log.error(err);
                    res.status(500).json({
                        error: "Analysis failed",
                        message: err.message,
                    });
                }
            });
        }
    }

    async getUserInfo(userId) {
        // Send a request to get user information from Slack
        const result = await this.webClient.users.info({ user: userId });

        const user = result.user;

        return {
            id: user.id,
            name: user.name || user.real_name,
            username: user.name,
            email: user.profile?.email,
            title: user.profile?.title,
            timezone: user.tz,
            profile: {
                firstName: user.profile?.first_name,
                lastName: user.profile?.last_name,
                statusText: user.profile?.status_text,
            },
        };
    }

    // This is the pipeline that reasearchs a member,
    // runs AI anaylsis, saves this to database and post to Slack
    async analyzeAndPostMember(memberInfo) {
        let analysisObj = null;

        try {
            log.info(`Processing member: ${memberInfo.name}`);

            // Do basic search like company website, github profile...
            const researchData = await this.doBasicResearch(memberInfo);

            // Let the AI analyze
            const analysis = await this.analyzeWithAi(memberInfo, researchData);

            // Save them to the database
            log.info(`Saving analysis to database for ${memberInfo.name}`);

            analysisObj = await saveMemberAnalysis(
                memberInfo,
                analysis,
                researchData,
            );

            // Post the analysis to the private Slack channel
            await this.postAnalysisToChannel(
                memberInfo,
                analysis,
                researchData,
            );

            // Mark as sent to Slack
            await analysisObj.update({ sentToSlack: true });
        } catch (err) {
            log.error(`Error processing ${memberInfo.name}: ${err.message}`);
            if (analysisObj) {
                log.info(
                    `Analysis ${analysisObj.dataValues.id} saved to database but not sent to Slack due to error`,
                );
            }

            throw err;
        }
    }

    // Access public availabel information for the user
    async doBasicResearch(memberInfo) {
        const results = [];

        try {
            // When the user isn't a non-personal email. Check his website
            if (memberInfo.email && !this.personalEmail(memberInfo.email)) {
                const domain = memberInfo.email.split("@")[1];

                const companyInfo = await this.getCompanyInfo(domain);

                // In case found. Push it
                if (companyInfo) {
                    results.push(companyInfo);
                }

                // Search for github for a matching name
                if (memberInfo.name) {
                    const githubInfo = await this.getGithubInfo(
                        memberInfo.name,
                    );

                    if (githubInfo) results.push(githubInfo);
                }
            }

            return results;
        } catch (err) {
            log.err(`Research error: ${err.message}`);
        }
    }

    async getCompanyInfo(domain) {
        try {
            const url = `https://www.${domain}`;

            const res = await axios.get(url, {
                timeout: 5000, // 5 seconds,
                headers: {
                    // To feels like normal user request and not get blocked from the website
                    "User-Agent": "Mozilla/5.0",
                },
            });

            // Search for the title
            const titleMatched = res.data.match(/<title>(.*?)<\/title>/);
            const title = titleMatched ? titleMatched[0] : `Company: ${domain}`;

            return {
                url,
                title,
                content: `Company website for ${domain}`,
                type: "company",
            };
        } catch (err) {
            log.error(`Coudln't fetch ${domain}: ${err.message}`);
            return null;
        }
    }

    async getGithubInfo(name) {
        // We might find the same username (this has a mistake margin)

        try {
            const res = await axios.get(
                `https://api.github.com/search/users?q=${encodeURIComponent(name)}`,
                { timeout: 5000 },
            );

            if (res.data?.items && res.data.items.length > 0) {
                const user = res.data.items[0];

                return {
                    url: user.html_url,
                    title: `Github: ${user.login}`,
                    content: `${user.public_repos} public respositories`,
                    type: "github",
                };
            }
        } catch (err) {
            log.debug("Gitbub search error: ", err.message);
        }

        return null;
    }

    async analyzeWithAi(memberInfo, researchData) {
        const prompt = ChatPromptTemplate.fromTemplate(
            `Analyze this new community member for fit with our commercial 
            product.

            Company: ${process.env.COMPANY_NAME || "Your Company"}
            Product: ${process.env.COMPANY_PRODUCT || "Your Product"}

            Member:
            - Name: {name}
            - Email: {email}
            - Title: {title}

            Research Data:
            {research}

            Provide a JSON response with:
            - fitScore (0-100): likelihood they'd be interested in our product
            - insights: array of 3-5 key observations
            - recommendations: array of 2-4 engagement suggestions

            Consider job title, company size, technical background, and budget authority.`,
        );

        try {
            let researchSummary = "limited research data available";

            if (researchData.length > 0) {
                researchSummary = researchData
                    .map((response) => `${response.title}: ${response.content}`)
                    .join("\n");
            }

            // Start the chain from the model
            const chain = prompt.pipe(this.openai);

            // Call the model and pass to it the data to fill it in the prompt before sending it
            const result = await chain.invoke({
                name: memberInfo.name,
                email: memberInfo.email || "Not provided",
                title: memberInfo.title || "Not provided",
                research: researchSummary,
            });

            const responseText = result.text || result;

            console.log('\n#############\n', responseText, '\n#############\n');

            // As the response will be json, but it will be wrapped with text
            const cleanedResponse = responseText
                .replace(/```json\n?|\n?```/, "")
                .trim();

            const analysis = JSON.parse(cleanedResponse);

            return {
                fitScore: Math.max(0, Math.min(100, analysis.fitScore || 50)),
                insights: Array.isArray(analysis.insights)
                    ? analysis.insights
                    : ["Analysis completed"],
                recommendations: Array.isArray(analysis.recommendations)
                    ? analysis.recommendations
                    : ["Follow up recommended "],
            };
        } catch (err) {
            log.error(`AI analysis error: ${err.message}`);
            return {
                fitScore: 50,
                insights: ["unable to complete full analysis"],
                recommendations: ["Manual review recommended"],
            };
        }
    }

    async postAnalysisToChannel(member, analysis, researchData) {
        let color = "";

        if (analysis.fitScore >= 80) {
            color = "#36a64f";
        } else if (analysis.fitScore >= 60) {
            color = "#ffb84d";
        } else if (analysis.fitScore >= 40) {
            color = "#ff9500";
        } else {
            color = "#ff4444";
        }

        // We will build Slack block kit message
        const blocks = [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `🔍 New Memeber: ${member.name}`,
                },
            },

            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Fit Score:* ${analysis.fitScore}/100`,
                    },
                    {
                        type: "mrkdwn",
                        text: `*Email:* ${member.email || "Not provided"}`,
                    },
                    {
                        type: "mrkdwn",
                        text: `*Title:* ${member.title || "Not provided"}`,
                    },
                ],
            },
        ];

        if (analysis.insights?.length > 0) {
            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Insights:*\n${analysis.insights.map((insight) => `• ${insight}`).join("\n")}`,
                },
            });
        }

        if (analysis.recommendations?.length > 0) {
            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Recommendations:*\n${analysis.recommendations.map((recom) => `• ${recom}`).join("\n")}`,
                },
            });
        }

        blocks.push({
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `📊Analyzed: ${new Date().toISOString()}`,
                },
            ],
        });

        // Push that message to the private channel
        await this.webClient.chat.postMessage({
            channel: process.env.SLACK_PRIVATE_CHANNEL_ID,
            text: `new Memeber Analysis: ${member.name} (${analysis.fitScore}/100)`,
            attachments: [
                {
                    color,
                    blocks,
                },
            ],
        });

        log.info(`Analysis posted for channed for ${member.name}`);
    }

    personalEmail(email) {
        const personalDomains = [
            "gmail.com",
            "yahoo.com",
            "hotmail.com",
            "outlook.com",
            "icloud.com",
        ];
        const domain = email.split("@").at(-1)?.toLowerCase();

        return personalDomains.includes(domain);
    }

    async start() {
        try {
            log.info(`Connecting to database...`);

            await connectDB();
            const port = process.env.PORT || 3000;

            this.server = this.app.listen(port, () => {
                log.info(`Express server running on port ${port}`);
            });

            await this.slack.start();
            log.info(`Slack bot connected`);

            log.info(`Slack AI Agent is running!`);

            if (process.env.NODE_ENV === "development") {
                log.info(
                    `Test endpoint: http://localhost:${port}/test/analyze-member`,
                );
            }
        } catch (err) {
            log.error(`Failed to start: ${err.message}`);
            process.exit(1);
        }
    }

    async stop() {
        log.info("Shutting down...");
        try {
            await this.slack.stop();
            if (this.server) {
                await new Promise((res) => this.server.close(res));
            }

            await closeDatabase();
            log.insight("Stopped successfully");
        } catch (err) {
            log.error("Shutdown error: ", error.message);
        }
    }
}

const agent = new SlackAIAgent();

process.on("SIGINT", () => agent.stop());
process.on("SIGTERM", () => agent.stop());

agent.start().catch((err) => {
    console.error("Startup failed: ", err.message);
    process.exit(1);
});

export default agent;
