import pg from "pg";
import {readFile} from "node:fs/promises";
import {dbConfig} from "../lib/db-config.mjs";
const client = new pg.Client(dbConfig());
await client.connect();
try {
 await client.query(await readFile(new URL("./schema.sql", import.meta.url),"utf8"));
 console.log("Схема журнала готова.");
} finally {await client.end();}
