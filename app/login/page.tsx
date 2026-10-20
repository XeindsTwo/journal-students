import {redirect} from 'next/navigation';
import {authenticated,getOwner} from '@/lib/auth';
import {safeReturnPath} from '@/lib/auth-crypto.mjs';
import LoginForm from './login-form';
export const metadata={title:'Вход — Электронный журнал'};
export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string}>}){const next=safeReturnPath((await searchParams).next);if(await authenticated())redirect(next);return <LoginForm configured={Boolean(await getOwner())} returnTo={next}/>;}
