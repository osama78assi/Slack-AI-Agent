import dotenv from "dotenv";
import { join } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({
    path: join(__dirname, "../.env"),
});

export default {
    development: {
        use_env_variable: "DATABASE_CONNECTION_STRING",
        dialect: "postgres",
    },
    test: {
        use_env_variable: "DATABASE_CONNECTION_STRING",
        dialect: "postgres",
    },
    production: {
        use_env_variable: "DATABASE_CONNECTION_STRING",
        dialect: "postgres",
    },
};
