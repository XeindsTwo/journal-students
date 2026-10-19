export function dbConfig() {
 return process.env.DATABASE_URL ? {connectionString:process.env.DATABASE_URL} : {
 host:process.env.DB_HOST??"127.0.0.1",port:Number(process.env.DB_PORT??5433),
 database:process.env.DB_NAME??"para_journal",user:process.env.DB_USER,password:process.env.DB_PASSWORD
 };
}
