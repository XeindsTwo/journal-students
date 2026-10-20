import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {hashPassword} from '../lib/auth-crypto.mjs';
let env;try{env=await fs.readFile('.env.local','utf8');}catch{env=await fs.readFile('.env.example','utf8');}
const args=process.argv.slice(2);const configured=/^AUTH_PASSWORD_HASH=scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/m.test(env);
if(configured&&!args.includes('--reset'))throw Error('Вход уже настроен. Для замены пароля явно укажите --reset.');
const flag=args.indexOf('--username');const username=flag>=0?args[flag+1]:'xeindstwo';
if(!username||!/^[a-zA-Z0-9_.-]{3,64}$/.test(username))throw Error('Логин: 3–64 латинские буквы, цифры, точка, дефис или подчёркивание.');
const password='J!'+randomBytes(24).toString('base64url');const hash=await hashPassword(password);
env=env.replace(/^AUTH_USERNAME=.*\r?\n?/gm,'').replace(/^AUTH_PASSWORD_HASH=.*\r?\n?/gm,'').trimEnd()+'\nAUTH_USERNAME='+username+'\nAUTH_PASSWORD_HASH='+hash+'\n';
await fs.writeFile('.env.local',env);await fs.writeFile('.auth-owner.txt','Личный доступ к электронному журналу\n\nЛогин: '+username+'\nПароль: '+password+'\n\nVercel → Settings → Environment Variables:\nAUTH_USERNAME='+username+'\nAUTH_PASSWORD_HASH='+hash+'\n\nПароль и этот файл не загружать в GitHub.\nПосле изменения переменных Vercel нужен Redeploy.\n');
console.log('Вход настроен. Логин, сложный пароль и переменные Vercel находятся в .auth-owner.txt; секреты не выводятся в терминал.');
