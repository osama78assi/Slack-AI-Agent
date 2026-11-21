import { Sequelize, Model, DataTypes } from "sequelize";
import dotenv from "dotenv";
import log from "./util.js";

dotenv.config();

let sequelize = new Sequelize(process.env.DATABASE_CONNECTION_STRING, {
    dialect: "postgres",
    database: "slack_ai_agent",
});

class MemberAnalyses extends Model {}

MemberAnalyses.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        memberId: {
            type: DataTypes.STRING(255),
        },
        memberEmail: {
            type: DataTypes.STRING(255),
        },
        memberName: {
            type: DataTypes.STRING(255),
        },
        memberTitle: {
            type: DataTypes.STRING(255),
        },
        memberTimezone: {
            type: DataTypes.STRING(100),
        },
        fitScore: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        insights: {
            type: DataTypes.JSONB,
        },
        recommendations: {
            type: DataTypes.JSONB,
        },
        researchData: {
            type: DataTypes.JSONB,
        },
        sentToSlack: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        sentToSlackAt: {
            type: DataTypes.DATE,
        },
    },
    {
        sequelize: sequelize,
        timestamps: true,
        createdAt: "analyzedAt",
        updatedAt: false,
        underscored: true,
        indexes: [
            { fields: ["memberId"], type: "BTREE" },
            { fields: ["analyzedAt"], type: "BTREE" },
        ],
    },
);

export async function connectDB() {
    try {
        await sequelize.authenticate({ logging: false });
        log.info("Connected to database successfully");
    } catch (err) {
        log.error("Failed to connect to database: ", err.message);
        throw err;
    }
}

export async function saveMemberAnalysis(memberInfo, analysis, researchData) {
    try {
        const rec = await MemberAnalyses.create(
            {
                memberId: memberInfo.id || null,
                memberName: memberInfo.name,
                memberEmail: memberInfo.email || null,
                memberTitle: memberInfo.title || null,
                memberTimezone: memberInfo.timezone || null,
                fitScore: analysis.fitScore,
                insights: analysis.insights,
                recommendations: analysis.recommendations,
                researchData: analysis.researchData,
            },
            { returning: true },
        );

        log.info(rec.dataValues.id);
        return rec;
    } catch (err) {
        log.error(err.message);
        throw err;
    }
}

export async function closeDatabase() {
    try {
        await sequelize.close();
        log.info("Database connection closed");
    } catch (err) {
        log.error("Couldn't close database: ", err);
    }
}
