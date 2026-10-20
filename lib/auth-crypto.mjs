import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64);return 'scrypt:'+salt+':'+key.toString('hex');}
export function validPasswordHash(value){return typeof value==='string'&&/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value);}
export async function verifyPassword(password,hash){if(typeof password!=='string'||Buffer.byteLength(password)>512||!validPasswordHash(hash))return false;const [,salt,key]=hash.split(':');const actual=await derive(password,salt,64);return timingSafeEqual(actual,Buffer.from(key,'hex'));}
export function tokenHash(value){return createHash('sha256').update(value).digest('hex');}
export function newToken(){return randomBytes(32).toString('base64url');}
export function safeReturnPath(value){return typeof value==='string'&&/^\/journals\/[1-9]\d*$/.test(value)?value:'/';}
