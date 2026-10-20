import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {dbConfig} from '../lib/db-config.mjs';
import {verifyPassword} from '../lib/auth-crypto.mjs';
const execute=promisify(execFile),root=process.cwd(),suffix=randomBytes(8).toString('hex'),schema='qa_auth_'+suffix;
const directory=path.join(root,'.auth-db-test-'+suffix);await fs.mkdir(directory);const client=new pg.Client(dbConfig());await client.connect();let server;
try{
 await client.query('CREATE SCHEMA '+schema);
 await client.query('SET search_path TO '+schema);
 const sql=await fs.readFile('scripts/schema.sql','utf8');await client.query(sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS auth_sessions')));
 const config=dbConfig();let url;if(config.connectionString)url=new URL(config.connectionString);else{url=new URL('postgresql://127.0.0.1');url.hostname=config.host;url.port=String(config.port);url.pathname='/'+config.database;url.username=config.user;url.password=config.password;}
 url.searchParams.set('options','-c search_path='+schema);const env={...process.env,DATABASE_URL:url.toString(),AUTH_USERNAME:'ignored-value',AUTH_PASSWORD_HASH:'ignored-value'};
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3113'],{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Isolated server timeout')),20000);server.stdout.on('data',chunk=>{output+=chunk.toString();if(output.includes('Ready')){clearTimeout(timer);resolve();}});server.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited: '+code));});});
 const base='http://127.0.0.1:3113';assert.equal((await fetch(base+'/api/journal')).status,503);const empty=await fetch(base+'/login');assert.equal(empty.status,200);assert.ok((await empty.text()).includes('Учётная запись пока не создана'));
 const setupArgs=[path.join(root,'scripts/setup-auth.mjs')];await execute(process.execPath,setupArgs,{cwd:directory,env});
 const receipt=await fs.readFile(path.join(directory,'.auth-owner.txt'),'utf8');const password=receipt.match(/^Пароль: (.+)$/m)[1];const owner=(await client.query('SELECT * FROM auth_users')).rows[0];assert.equal(owner.username,'xeindstwo');assert.equal(await verifyPassword(password,owner.password_hash),true);assert.equal(owner.password_hash.includes(password),false);
 const login=async pass=>fetch(base+'/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:owner.username,password:pass})});
 const signedIn=await login(password);assert.equal(signedIn.status,200);const cookie=signedIn.headers.get('set-cookie').split(';')[0];const sessionCount=async()=>(await client.query('SELECT count(*)::int AS n FROM auth_sessions')).rows[0].n;assert.equal(await sessionCount(),1);
 await assert.rejects(execute(process.execPath,setupArgs,{cwd:directory,env}));assert.equal((await client.query('SELECT password_hash FROM auth_users')).rows[0].password_hash,owner.password_hash);assert.equal(await sessionCount(),1);
 await execute(process.execPath,[...setupArgs,'--reset'],{cwd:directory,env});assert.equal(await sessionCount(),0);assert.equal((await fetch(base+'/api/journal',{headers:{Cookie:cookie}})).status,401);assert.equal((await login(password)).status,401);
 const updated=await fs.readFile(path.join(directory,'.auth-owner.txt'),'utf8');const newPassword=updated.match(/^Пароль: (.+)$/m)[1];assert.notEqual(newPassword,password);assert.equal((await login(newPassword)).status,200);
 console.log('DB owner: empty database stays closed; setup and reset work without restart; existing owner is protected; password reset revokes old sessions; AUTH_* environment values are ignored.');
}finally{
 if(server){server.kill();await new Promise(resolve=>{if(server.exitCode!==null)resolve();else server.once('exit',resolve);});}
 await client.query('SET search_path TO public');await client.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await client.end();
 if(path.dirname(directory)!==root||!path.basename(directory).startsWith('.auth-db-test-'))throw Error('Unexpected temporary path');await fs.rm(directory,{recursive:true,force:true});
}
