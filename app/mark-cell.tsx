"use client";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {Check,Clock,UserX,Eraser,BadgeCheck,CircleAlert,X} from "lucide-react";
import type {Mark} from "@/lib/types";
import {useState,type KeyboardEvent,type RefCallback} from "react";
import {journalKeyAction} from "@/lib/journal-keyboard.mjs";
export type MarkEdit={operation:"add-grade"|"remove-grade"|"attendance"|"toggle-attendance"|"clear-grades"|"clear";grade?:number;index?:number;attendance?:"unknown"|"absent"|"late"};
type Props={mark?:Mark;disabled:boolean;label:string;onEdit:(edit:MarkEdit)=>unknown;cellRef?:RefCallback<HTMLButtonElement>;tabIndex?:number;onFocus?:()=>void;onNavigate?:(row:number,column:number)=>void};
const choices=[{value:5,Icon:BadgeCheck},{value:4,Icon:BadgeCheck},{value:3,Icon:BadgeCheck},{value:2,Icon:CircleAlert}];
export function MarkCell({mark,disabled,label,onEdit,cellRef,tabIndex,onFocus,onNavigate}:Props){
 const [dropdownOpen,setDropdownOpen]=useState(false);
 function keyboard(event:KeyboardEvent<HTMLButtonElement>){
 if(!onNavigate||disabled)return;
 const action=journalKeyAction(event);if(!action)return;event.preventDefault();event.stopPropagation();
 if(action.kind==="move")onNavigate(action.row!,action.column!);
 else if(action.kind==="escape")event.currentTarget.blur();
 else if(action.kind==="grade")void onEdit({operation:"add-grade",grade:action.grade});
 else if(action.kind==="attendance")void onEdit({operation:"toggle-attendance",attendance:action.attendance as "absent"|"late"});
 }
 const attendance=mark?.attendance??"unknown",grades=mark?.grades??(mark?.grade?[mark.grade]:[]);
 function items(type:"context"|"dropdown"){
 const Item=type==="context"?ContextMenu.Item:DropdownMenu.Item;
 const Separator=type==="context"?ContextMenu.Separator:DropdownMenu.Separator;
 return <>
 {choices.map(({value,Icon})=><Item key={value} className="mark-menu-item" disabled={disabled||grades.length>=100} onSelect={()=>onEdit({operation:"add-grade",grade:value})}><span className={`mark-indicator grade-${value}`}><Icon size={16}/></span>Поставить {value}</Item>)}
 <Separator className="menu-separator"/>
 <Item className="mark-menu-item" disabled={disabled} onSelect={()=>onEdit({operation:"toggle-attendance",attendance:"absent"})}><span className="mark-indicator absent"><UserX size={16}/></span>{attendance==="absent"?"Убрать Н":"Поставить Н"}{attendance==="absent"&&<Check size={16} className="menu-check"/>}</Item>
 <Item className="mark-menu-item" disabled={disabled} onSelect={()=>onEdit({operation:"toggle-attendance",attendance:"late"})}><span className="mark-indicator late"><Clock size={16}/></span>{attendance==="late"?"Убрать О":"Поставить О"}{attendance==="late"&&<Check size={16} className="menu-check"/>}</Item>
 {grades.length>0&&<><Separator className="menu-separator"/>{grades.map((grade,index)=><Item key={index} className="mark-menu-item" disabled={disabled} onSelect={()=>onEdit({operation:"remove-grade",grade,index})}><span className={`mark-badge grade-${grade}`}>{grade}</span>Убрать оценку №{index+1}<X size={15} className="menu-check"/></Item>)}</>}
 <Separator className="menu-separator"/>
 <Item className="mark-menu-item" disabled={disabled||grades.length===0} onSelect={()=>onEdit({operation:"clear-grades"})}><Eraser size={16}/>Убрать все оценки</Item>
 <Item className="mark-menu-item" disabled={disabled||!["absent","late"].includes(attendance)} onSelect={()=>onEdit({operation:"attendance",attendance:"unknown"})}><Eraser size={16}/>Убрать Н / О</Item>
 <Item className="mark-menu-item" disabled={disabled} onSelect={()=>onEdit({operation:"clear"})}><Eraser size={16}/>Очистить ячейку</Item>
 </>;
 }
 return <ContextMenu.Root><DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
 <ContextMenu.Trigger asChild disabled={disabled}><DropdownMenu.Trigger asChild disabled={disabled}>
 <button ref={cellRef} tabIndex={tabIndex} onFocus={onFocus} onKeyDownCapture={keyboard} className="mark-cell" aria-label={label} aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter 2 3 4 5 N O">
 {attendance==="absent"&&<span className="mark-badge absent">Н</span>}
 {attendance==="late"&&<span className="mark-badge late">О</span>}
 {grades.map((grade,index)=><span key={index} className={`mark-badge grade-${grade}`}>{grade}</span>)}
 {grades.length===0&&!["absent","late"].includes(attendance)&&<span className="unknown-dot">·</span>}
 </button></DropdownMenu.Trigger></ContextMenu.Trigger>
 <DropdownMenu.Portal><DropdownMenu.Content onKeyDownCapture={event=>{if(!onNavigate||disabled)return;const action=journalKeyAction(event);if(!action||!(action.kind==="grade"||action.kind==="attendance"))return;event.preventDefault();event.stopPropagation();if(action.kind==="grade")void onEdit({operation:"add-grade",grade:action.grade});else void onEdit({operation:"toggle-attendance",attendance:action.attendance as "absent"|"late"});setDropdownOpen(false);}} className="mark-menu dropdown-mark-menu" sideOffset={6} collisionPadding={12} sticky="always" avoidCollisions>{items("dropdown")}</DropdownMenu.Content></DropdownMenu.Portal>
 </DropdownMenu.Root>
 <ContextMenu.Portal><ContextMenu.Content className="mark-menu context-mark-menu" collisionPadding={12} sticky="always" avoidCollisions>{items("context")}</ContextMenu.Content></ContextMenu.Portal>
 </ContextMenu.Root>;
}
