import pg from 'pg';
import {dbConfig} from '../lib/db-config.mjs';
import {newToken,tokenHash} from '../lib/auth-crypto.mjs';
const client=new pg.Client(dbConfig());await client.connect();
const owner=(await client.query('SELECT username,password_hash FROM auth_users WHERE id=1')).rows[0];if(!owner)throw Error('Owner account is required for integration tests');
const token=newToken();await client.query("INSERT INTO auth_sessions(token_hash,owner_fingerprint,expires_at) VALUES($1,$2,now()+interval '10 minutes')",[tokenHash(token),tokenHash(owner.username+'\0'+owner.password_hash)]);
const base=process.env.TEST_URL??'http://127.0.0.1:3000';
export function authenticatedFetch(url,options={}){if(new URL(url).origin!==new URL(base).origin)throw Error('Refusing to send test session to another origin');const headers=new Headers(options.headers);headers.set('Cookie',(process.env.TEST_SECURE_COOKIE==='1'?'__Host-journal_session':'journal_session')+'='+token);return fetch(url,{...options,headers});}
export async function closeTestSession(){try{await client.query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(token)]);}finally{await client.end();}}
