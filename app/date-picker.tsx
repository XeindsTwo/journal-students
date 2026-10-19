"use client";
import * as Popover from "@radix-ui/react-popover";
import {DayPicker} from "react-day-picker";
import {ru} from "react-day-picker/locale";
import {CalendarDays,ChevronLeft,ChevronRight} from "lucide-react";
import {useState} from "react";
import {CustomSelect} from "./ui";
function fromValue(value:string){const d=new Date(value+"T12:00:00");return Number.isNaN(d.getTime())?undefined:d;}
function toValue(date:Date){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");}
const monthNames=Array.from({length:12},(_,i)=>new Date(2026,i,1).toLocaleDateString("ru",{month:"long"}));
export function DatePicker({name,value,defaultValue,label,onChange}:{name?:string;value?:string;defaultValue?:string;label:string;onChange?:(value:string)=>void}){
 const [local,setLocal]=useState(defaultValue??"");
 const current=value??local;
 const selected=fromValue(current);
 const [open,setOpen]=useState(false),[month,setMonth]=useState(selected??new Date());
 const currentYear=new Date().getFullYear();
 const years=Array.from({length:61},(_,i)=>currentYear-30+i);
 if(!years.includes(month.getFullYear()))years.push(month.getFullYear());
 function select(date:Date){const next=toValue(date);setLocal(next);onChange?.(next);setOpen(false);}
 return <><input type="hidden" name={name} value={current}/>
 <Popover.Root open={open} onOpenChange={next=>{if(next)setMonth(selected??new Date());setOpen(next);}}>
 <Popover.Trigger asChild><button type="button" className="date-trigger" aria-label={label}><span>{selected?selected.toLocaleDateString("ru",{day:"2-digit",month:"long",year:"numeric"}):"Выбрать дату"}</span><CalendarDays size={18}/></button></Popover.Trigger>
 <Popover.Portal><Popover.Content className="calendar-popover" sideOffset={8} collisionPadding={12} align="start" aria-label={"Календарь: "+label}>
 <div className="calendar-heading"><button type="button" className="calendar-arrow" aria-label="Предыдущий месяц" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={18}/></button>
 <CustomSelect label="Месяц" value={String(month.getMonth())} onValueChange={v=>setMonth(new Date(month.getFullYear(),Number(v),1))} options={monthNames.map((m,i)=>({value:String(i),label:m[0].toUpperCase()+m.slice(1)}))}/>
 <CustomSelect label="Год" value={String(month.getFullYear())} onValueChange={v=>setMonth(new Date(Number(v),month.getMonth(),1))} options={years.sort((a,b)=>a-b).map(y=>({value:String(y),label:String(y)}))}/>
 <button type="button" className="calendar-arrow" aria-label="Следующий месяц" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={18}/></button></div>
 <DayPicker mode="single" required locale={ru} selected={selected} onSelect={select} month={month} onMonthChange={setMonth} hideNavigation showOutsideDays weekStartsOn={1} animate classNames={{month_caption:"sr-only"}}/>
 <div className="calendar-footer"><button type="button" onClick={()=>select(new Date())}>Сегодня</button><Popover.Close className="calendar-done">Готово</Popover.Close></div>
 </Popover.Content></Popover.Portal></Popover.Root></>;
}

