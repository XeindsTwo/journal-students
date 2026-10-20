import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {dbConfig} from '../lib/db-config.mjs';
import {tokenHash,newToken} from '../lib/auth-crypto.mjs';
const base=process.env.TEST_URL??'http://127.0.0.1:3000';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('This auth test only uses a local server');
const client=new pg.Client(dbConfig());await client.connect();const owner=(await client.query('SELECT username,password_hash FROM auth_users WHERE id=1')).rows[0];const username=owner?.username;let password=process.env.AUTH_TEST_PASSWORD;
if(!password){const local=await fs.readFile('.auth-owner.txt','utf8');password=local.match(/^Пароль: (.+)$/m)?.[1];}if(!username||!password)throw Error('Local owner credentials are required');
const issued=[];const ip='auth-test-'+randomBytes(12).toString('hex');const limitedIp=ip+'-limit';const cookieName=process.env.TEST_SECURE_COOKIE==='1'?'__Host-journal_session':'journal_session';
const post=(path,body,extra={})=>fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json','x-real-ip':ip,...extra},body:JSON.stringify(body)});
const readCookie=response=>{const raw=response.headers.get('set-cookie');assert.ok(raw,'session cookie is missing');assert.match(raw,/HttpOnly/i);assert.match(raw,/SameSite=Lax/i);assert.match(raw,/Max-Age=604800/i);assert.match(raw,/Path=\//i);if(process.env.TEST_SECURE_COOKIE==='1')assert.match(raw,/Secure/i);const cookie=raw.split(';')[0];assert.ok(cookie.startsWith(cookieName+'='));issued.push(cookie.slice(cookie.indexOf('=')+1));return cookie;};
try{
 const before=(await client.query('SELECT count(*)::int AS n FROM groups')).rows[0].n;
 for(const path of ['/','/journals/11']){const response=await fetch(base+path,{redirect:'manual'});assert.equal(response.status,307);assert.ok(response.headers.get('location')?.startsWith('/login'));}
 const page=await fetch(base+'/login');assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('Вход в журнал'));assert.ok(html.includes('name="username"'));assert.ok(html.includes('type="password"'));assert.equal(html.includes(password),false);assert.equal(html.includes(owner.password_hash),false);
 assert.equal((await fetch(base+'/api/journal')).status,401);
 assert.equal((await post('/api/journal',{action:'group',name:'should-not-exist',names:[],joined_on:'2026-09-01'})).status,401);
 assert.equal((await client.query('SELECT count(*)::int AS n FROM groups')).rows[0].n,before);
 assert.equal((await fetch(base+'/api/journal',{headers:{Cookie:cookieName+'='+newToken()}})).status,401);
 assert.equal((await post('/api/auth/login',{username,password},{Origin:'https://other.invalid'})).status,403);
 assert.equal((await post('/api/auth/login',{username,password:'incorrect-test-password'})).status,401);
 const login=await post('/api/auth/login',{username,password});assert.equal(login.status,200);const cookie=readCookie(login);
 const data=await fetch(base+'/api/journal',{headers:{Cookie:cookie}});assert.equal(data.status,200);assert.match(data.headers.get('cache-control'),/no-store/);
 const home=await fetch(base+'/',{headers:{Cookie:cookie},redirect:'manual'});assert.equal(home.status,200);assert.ok((await home.text()).includes('Электронный журнал'));
 const deniedLogout=await post('/api/auth/logout',{}, {Cookie:cookie,Origin:'https://other.invalid'});assert.equal(deniedLogout.status,403);assert.equal((await fetch(base+'/api/journal',{headers:{Cookie:cookie}})).status,200);
 const logout=await post('/api/auth/logout',{}, {Cookie:cookie});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/i);assert.equal((await fetch(base+'/api/journal',{headers:{Cookie:cookie}})).status,401);
 const second=await post('/api/auth/login',{username,password});assert.equal(second.status,200);const expired=readCookie(second);await client.query("UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(issued.at(-1))]);assert.equal((await fetch(base+'/api/journal',{headers:{Cookie:expired}})).status,401);
 for(let i=0;i<10;i++)assert.equal((await post('/api/auth/login',{username,password:'incorrect-test-password'},{'x-real-ip':limitedIp})).status,401);
 const limit=await post('/api/auth/login',{username,password},{'x-real-ip':limitedIp});assert.equal(limit.status,429);assert.equal(limit.headers.get('retry-after'),'900');
 console.log('Auth: protected pages/API, correct login, wrong password, private cookie, logout revocation, expiry, CSRF and persistent rate limits passed.');
}finally{await client.query('DELETE FROM auth_sessions WHERE token_hash=ANY($1::text[])',[issued.map(tokenHash)]);await client.query('DELETE FROM auth_attempts WHERE key=ANY($1::text[])',[[tokenHash(ip),tokenHash(limitedIp)]]);await client.end();}
