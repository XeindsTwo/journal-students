import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {cookieOptions,getOwner,sameOrigin,sessionCookie,SESSION_SECONDS} from '@/lib/auth';
import {newToken,tokenHash,verifyPassword} from '@/lib/auth-crypto.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(error:string,status:number)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return reply('Запрос с другого сайта запрещён',403);
 if(Number(request.headers.get('content-length')??0)>4096)return reply('Слишком большой запрос',413);
 let input;try{input=await request.json();}catch{return reply('Проверь логин и пароль',400);}
 if(!input||typeof input.username!=='string'||input.username.length>100||typeof input.password!=='string'||input.password.length>128)return reply('Проверь логин и пароль',400);
 let client;
 try{
 const owner=await getOwner();if(!owner)return reply('Учётная запись ещё не создана в базе',503);
 client=await db.connect();await client.query('BEGIN');
 const ip=request.headers.get('x-real-ip')??request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'local';
 const keys=[{key:'global',limit:60},{key:tokenHash(ip),limit:10}];
 for(const {key,limit} of keys){const attempt=(await client.query("INSERT INTO auth_attempts(key,attempts,window_start) VALUES($1,1,now()) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE auth_attempts.attempts+1 END,window_start=CASE WHEN auth_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE auth_attempts.window_start END RETURNING attempts",[key])).rows[0];if(attempt.attempts>limit){await client.query('COMMIT');const response=reply('Слишком много попыток. Попробуй через 15 минут.',429);response.headers.set('Retry-After','900');return response;}}
 await client.query('COMMIT');
 const correctPassword=await verifyPassword(input.password,owner.hash);
 if(input.username!==owner.username||!correctPassword)return reply('Неверный логин или пароль',401);
 const token=newToken();
 await client.query('BEGIN');
 await client.query('DELETE FROM auth_sessions WHERE expires_at<=now() OR owner_fingerprint<>$1',[owner.fingerprint]);
 await client.query("DELETE FROM auth_attempts WHERE key=$1 OR window_start<now()-interval '1 day'",[tokenHash(ip)]);
 const previous=request.cookies.get(sessionCookie())?.value;if(previous)await client.query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(previous)]);
 await client.query("INSERT INTO auth_sessions(token_hash,owner_fingerprint,expires_at) VALUES($1,$2,now()+$3*interval '1 second')",[tokenHash(token),owner.fingerprint,SESSION_SECONDS]);
 await client.query('COMMIT');
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});response.cookies.set(sessionCookie(),token,cookieOptions());return response;
 }catch{if(client)await client.query('ROLLBACK').catch(()=>{});return reply('Не удалось войти. Проверь подключение и схему базы.',503);}finally{client?.release();}
}
