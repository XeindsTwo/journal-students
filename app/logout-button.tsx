"use client";
import {useState} from 'react';
import {LogOut,LoaderCircle} from 'lucide-react';
import {markQueue} from './mark-sync';
export function LogoutButton(){const [busy,setBusy]=useState(false),[error,setError]=useState('');return <div className="logout-control"><button className="text-button logout-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await markQueue.drain();const response=await fetch('/api/auth/logout',{method:'POST'});if(!response.ok)throw Error('Не удалось выйти. Попробуй ещё раз.');window.location.replace('/login');}catch(e){setError(e instanceof Error?e.message:'Не удалось выйти');setBusy(false);}}}>{busy?<LoaderCircle size={17} className="spin"/>:<LogOut size={17}/>}Выйти</button>{error&&<span role="alert" className="logout-error">{error}</span>}</div>}
