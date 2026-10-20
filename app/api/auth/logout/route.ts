import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {sameOrigin,sessionCookie,cookieOptions} from '@/lib/auth';
import {tokenHash} from '@/lib/auth-crypto.mjs';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 if(!sameOrigin(request))return NextResponse.json({error:'Запрос с другого сайта запрещён'},{status:403});
 const token=request.cookies.get(sessionCookie())?.value;
 try{if(token)await db.query('DELETE FROM auth_sessions WHERE token_hash=$1',[tokenHash(token)]);}catch{return NextResponse.json({error:'Не удалось завершить сессию. Попробуй ещё раз.'},{status:503});}
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});response.cookies.set(sessionCookie(),'',{...cookieOptions(),maxAge:0});return response;
}
