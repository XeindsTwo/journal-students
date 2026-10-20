import pg from 'pg';
import {dbConfig} from '../lib/db-config.mjs';
import {newToken,tokenHash} from '../lib/auth-crypto.mjs';
const client=new pg.Client(dbConfig());await client.connect();
if(!process.env.AUTH_USERNAME||!process.env.AUTH_PASSWORD_HASH)throw Error('Auth configuration is required for integration tests');
const token=newToken();await client.query("INSERT INTO auth_sessions(token_hash,owner_fingerprint,expires_at) VALUES($1,$2,now()+interval '10 minutes')",[tokenHash(token),tokenHash(process.env.AUTH_USERNAME+'\0'+process.env.AUTH_PASSWORD_HASH)]);
const base=process.env.TEST_URL??'http://127.0.0.1:3000';
export function authenticatedFetch(url,options={}){if(new URL(url).origin!==new URL(base).origin)throw Error('Refusing to send test session to another origin');const headers=new Headers(options.headers);headers.set('Cookie',(process.env.TEST_SECURE_COOKIE==='1'?'__Host-journal_session':'journal_session')+'='+token);return fetch(url,{...options,headers});}
export async function closeTestSession(){try{await client.query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(token)]);}finally{await client.end();}}
