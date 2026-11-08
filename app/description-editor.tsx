"use client";
import {useId,useRef} from "react";
import type {ReactNode} from "react";

const formats=[{mark:"**",label:"Жирный",sample:<strong>Ж</strong>},{mark:"*",label:"Курсив",sample:<em>К</em>},{mark:"++",label:"Подчёркнутый",sample:<u>П</u>}];

function preview(value:string,depth=0):ReactNode {
 if(depth>=4)return value;
 return value.split(/(\*\*\*[^\n]+?\*\*\*|\*\*[^\n]+?\*\*|\*[^*\n]+?\*|\+\+[^\n]+?\+\+)/).map((part,i)=>{
  if(i%2===0)return part;
  if(part.startsWith("***"))return <strong key={i}><em>{preview(part.slice(3,-3),depth+1)}</em></strong>;
  if(part.startsWith("**"))return <strong key={i}>{preview(part.slice(2,-2),depth+1)}</strong>;
  if(part.startsWith("++"))return <u key={i}>{preview(part.slice(2,-2),depth+1)}</u>;
  return <em key={i}>{preview(part.slice(1,-1),depth+1)}</em>;
 });
}

export function DescriptionEditor({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
 const id=useId(), field=useRef<HTMLTextAreaElement>(null);
 function wrap(mark:string){
  const input=field.current;if(!input)return;
  const {selectionStart:start,selectionEnd:end}=input;
  const unwrap=start>=mark.length&&value.slice(start-mark.length,start)===mark&&value.slice(end,end+mark.length)===mark;
  const text=unwrap?value.slice(0,start-mark.length)+value.slice(start,end)+value.slice(end+mark.length):value.slice(0,start)+mark+value.slice(start,end)+mark+value.slice(end);
  if(text.length>20000)return;
  onChange(text);const offset=unwrap?-mark.length:mark.length;
  requestAnimationFrame(()=>{if(field.current===input){input.focus();input.setSelectionRange(start+offset,end+offset);}});
 }
 return <div className="field description-editor">
  <label htmlFor={id}>{label}</label>
  <div className="description-toolbar" role="group" aria-label="Форматирование описания">
   {formats.map(({mark,label,sample})=><button key={mark} type="button" className="button secondary" aria-label={label} title={label} onMouseDown={e=>e.preventDefault()} onClick={()=>wrap(mark)}>{sample}</button>)}
  </div>
  <textarea id={id} ref={field} autoComplete="off" rows={4} maxLength={20000} value={value} onChange={e=>onChange(e.target.value)}/>
  {value&&<div><span className="form-hint">Предпросмотр</span><div className="description-preview">{preview(value)}</div></div>}
 </div>;
}
