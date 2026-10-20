import 'server-only';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {NextRequest,NextResponse} from 'next/server';
import {db} from './db';
import {validPasswordHash,tokenHash,safeReturnPath} from './auth-crypto.mjs';
export const SESSION_SECONDS=7*24*60*60;
export const sessionCookie=()=>process.env.NODE_ENV==='production'?'__Host-journal_session':'journal_session';
export function ownerConfig(){const username=process.env.AUTH_USERNAME,hash=process.env.AUTH_PASSWORD_HASH;if(!username||username.length>100||!validPasswordHash(hash))return null;return {username,hash:hash!,fingerprint:tokenHash(username+'\0'+hash)};}
export function cookieOptions(){return {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge:SESSION_SECONDS};}
export async function authenticated(){const owner=ownerConfig();if(!owner)return false;const token=(await cookies()).get(sessionCookie())?.value;if(!token||!/^[-_A-Za-z0-9]{43}$/.test(token))return false;const result=await db.query('SELECT 1 FROM auth_sessions WHERE token_hash=$1 AND owner_fingerprint=$2 AND expires_at>now()',[tokenHash(token),owner.fingerprint]);return result.rowCount===1;}
export async function requireOwner(returnTo='/'){if(!await authenticated()){const next=safeReturnPath(returnTo);redirect(next==='/'?'/login':'/login?next='+encodeURIComponent(next));}}
export async function authGuard(){if(!ownerConfig())return NextResponse.json({error:'Вход не настроен. Укажите AUTH_USERNAME и AUTH_PASSWORD_HASH на сервере.'},{status:503,headers:{'Cache-Control':'no-store'}});try{if(!await authenticated())return NextResponse.json({error:'Сессия завершена. Войдите в журнал снова.'},{status:401,headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Не удалось проверить вход. Проверьте подключение к базе.'},{status:503,headers:{'Cache-Control':'no-store'}});}return null;}
export function sameOrigin(request:NextRequest){const origin=request.headers.get('origin');if(!origin)return false;try{const value=new URL(origin);return ['https:','http:'].includes(value.protocol)&&value.host===request.headers.get('host');}catch{return false;}}
