"use client";
import {Monitor,Wifi,PenLine,BookOpen,ClipboardCheck,Tag,FlaskConical} from "lucide-react";
export function tagStyle(name:string){
 const n=name.toLocaleLowerCase();
 if(n.includes("дистант"))return {Icon:Wifi,tone:"blue"};
 if(n.includes("самостоят"))return {Icon:PenLine,tone:"violet"};
 if(n.includes("практик"))return {Icon:Monitor,tone:"green"};
 if(n.includes("лекц"))return {Icon:BookOpen,tone:"amber"};
 if(n.includes("контрол"))return {Icon:ClipboardCheck,tone:"rose"};
 if(n.includes("лабор"))return {Icon:FlaskConical,tone:"teal"};
 const tones=["blue","violet","green","amber","rose","teal"];
 const hash=Array.from(n).reduce((a,c)=>a+c.charCodeAt(0),0);
 return {Icon:Tag,tone:tones[hash%tones.length]};
}
export function TagBadge({name}:{name:string}){const {Icon,tone}=tagStyle(name);return <span className={`tag tone-${tone}`}><Icon size={16}/>{name}</span>}
