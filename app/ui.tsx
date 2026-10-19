"use client";
import * as Select from "@radix-ui/react-select";
import * as Dialog from "@radix-ui/react-dialog";
import {Check,ChevronDown,ChevronUp} from "lucide-react";
import {motion,useReducedMotion} from "motion/react";
import {useState,type ReactNode} from "react";

type Option={value:string;label:string};
export function CustomSelect({options,value,defaultValue,name,label,onValueChange,disabled,className=""}:{options:Option[];value?:string;defaultValue?:string;name?:string;label:string;onValueChange?:(value:string)=>void;disabled?:boolean;className?:string}){
 const [local,setLocal]=useState(defaultValue??options[0]?.value??"");
 const current=value??local;
 const encode=(v:string)=>v===""?"__empty__":v;
 return <Select.Root name={name} value={encode(current)} disabled={disabled} onValueChange={v=>{const next=v==="__empty__"?"":v;setLocal(next);onValueChange?.(next);}}>
 <Select.Trigger aria-label={label} className={"select-trigger "+className}><Select.Value/><Select.Icon><ChevronDown size={18}/></Select.Icon></Select.Trigger>
 <Select.Portal><Select.Content className="select-content" position="popper" sideOffset={8} collisionPadding={16}>
 <Select.ScrollUpButton className="select-scroll"><ChevronUp size={16}/></Select.ScrollUpButton>
 <Select.Viewport className="select-viewport">{options.map(o=><Select.Item key={encode(o.value)} value={encode(o.value)} className="select-item"><Select.ItemText>{o.label}</Select.ItemText><Select.ItemIndicator><Check size={16}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport>
 <Select.ScrollDownButton className="select-scroll"><ChevronDown size={16}/></Select.ScrollDownButton>
 </Select.Content></Select.Portal></Select.Root>;
}
export function AnimatedDialog({children,label,onClose,drawer=false,wide=false}:{children:ReactNode;label:string;onClose:()=>void;drawer?:boolean;wide?:boolean}){
 const reduced=useReducedMotion();
 return <Dialog.Root open onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal forceMount>
 <Dialog.Overlay asChild forceMount><motion.div className={drawer?"overlay drawer-overlay":"overlay"} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:.225}}>
 <Dialog.Content asChild forceMount aria-describedby={undefined}><motion.section className={drawer?"drawer":wide?"modal quick-fill-modal":"modal"} initial={reduced?{opacity:0}:drawer?{x:64,opacity:0}:{y:24,scale:.97,opacity:0}} animate={{x:0,y:0,scale:1,opacity:1}} exit={reduced?{opacity:0}:drawer?{x:64,opacity:0}:{y:16,scale:.98,opacity:0}} transition={{type:"spring",duration:reduced?0:.48,bounce:.08}}>
 <Dialog.Title className="sr-only">{label}</Dialog.Title>{children}
 </motion.section></Dialog.Content>
 </motion.div></Dialog.Overlay>
 </Dialog.Portal></Dialog.Root>;
}
