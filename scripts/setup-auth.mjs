import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {dbConfig} from '../lib/db-config.mjs';
import {hashPassword} from '../lib/auth-crypto.mjs';
const args=process.argv.slice(2);const client=new pg.Client(dbConfig());await client.connect();
try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtextextended('journal-owner-setup',0))");const existing=(await client.query('SELECT username FROM auth_users WHERE id=1 FOR UPDATE')).rows[0];if(existing&&!args.includes('--reset'))throw Error('Учётка в базе уже есть. Для замены пароля явно укажи --reset.');
const flag=args.indexOf('--username');const username=flag>=0?args[flag+1]:(existing?.username??'xeindstwo');if(!username||!/^[a-zA-Z0-9_.-]{3,64}$/.test(username))throw Error('Логин: 3–64 латинские буквы, цифры, точка, дефис или подчёркивание.');
const password='J!'+randomBytes(24).toString('base64url');const hash=await hashPassword(password);
await client.query('INSERT INTO auth_users(id,username,password_hash) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET username=$1,password_hash=$2,updated_at=now()',[username,hash]);await client.query('DELETE FROM auth_sessions');await client.query('COMMIT');
await fs.writeFile('.auth-owner.txt','Личный доступ к электронному журналу\n\nЛогин: '+username+'\nПароль: '+password+'\n\nУчётная запись и хеш пароля хранятся в PostgreSQL.\nЭтот файл — только памятка, приложение его не читает.\nНе загружать его в GitHub.\n');console.log('Учётка сохранена в PostgreSQL. Данные для входа — в локальном файле .auth-owner.txt; секреты не выводятся.');
}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{await client.end();}
