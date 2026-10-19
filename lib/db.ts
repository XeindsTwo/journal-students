import { Pool } from "pg";
import {dbConfig} from "./db-config.mjs";
const globalPg = globalThis as unknown as { journalPool?: Pool };
export const db = globalPg.journalPool ?? new Pool({...dbConfig(),max:5});
if (process.env.NODE_ENV !== "production") globalPg.journalPool = db;
