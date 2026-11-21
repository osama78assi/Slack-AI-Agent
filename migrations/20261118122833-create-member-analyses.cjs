"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("member_analyses", {
            id: {
                type: Sequelize.BIGINT,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false,
            },
            member_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            member_email: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            member_name: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            member_title: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            member_timezone: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            fit_score: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            insights: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            recommendations: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            research_data: {
                type: Sequelize.JSONB,
                allowNull: true,
            },
            sent_to_slack: {
                type: Sequelize.BOOLEAN,
                defaultValue: true,
                allowNull: true,
            },
            sent_to_slack_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            analyzed_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
        });

        await queryInterface.addIndex("member_analyses", ["member_id"], {
            name: "member_analyses_member_id_idx",
            using: "BTREE",
        });

        await queryInterface.addIndex("member_analyses", ["analyzed_at"], {
            name: "member_analyses_analyzed_at_idx",
            using: "BTREE",
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable("member_analyses");
    },
};
