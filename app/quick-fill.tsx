"use client";
import {useRef,useState,type KeyboardEvent} from "react";
import {AnimatePresence} from "motion/react";
import {Check,LoaderCircle,X} from "lucide-react";
import {AnimatedDialog,CustomSelect} from "./ui";
import type {Lesson,Student,Mark} from "@/lib/types";
import {activeOn} from "@/lib/domain.mjs";

type Draft={grade?:string;attendance?:"unknown"|"absent"|"late"};
export function QuickFill({initialLessonId,lessons,students,marks,onSaved,onClose}:{initialLessonId:number;lessons:Lesson[];students:Student[];marks:Mark[];onSaved:(marks:Mark[])=>Promise<void>;onClose:()=>void}){
 const [lessonId,setLessonId]=useState(initialLessonId),[drafts,setDrafts]=useState<Record<number,Draft>>({});
 const [saving,setSaving]=useState(false),[error,setError]=useState(""),[discard,setDiscard]=useState(false),[changeTarget,setChangeTarget]=useState<number|null>(null);
 const [retryLocked,setRetryLocked]=useState(false);
 const request=useRef<{key:string;id:string}|null>(null);
 const fields=useRef<Record<number,HTMLInputElement|null>>({});
 const lesson=lessons.find(l=>l.id===lessonId);
 const roster=students.filter(s=>lesson&&activeOn(s,lesson.date));
 const rows=roster.flatMap(s=>{const d=drafts[s.id];if(!d)return [];
 const row:{student_id:number;grade?:number;attendance?:Draft["attendance"]}={student_id:s.id};
 if(d.grade)row.grade=Number(d.grade);
 if(d.attendance!==undefined)row.attendance=d.attendance;
 return row.grade===undefined&&row.attendance===undefined?[]:[row];});
 const dirty=rows.length>0;
 const markFor=(id:number)=>marks.find(m=>m.lesson_id===lessonId&&m.student_id===id);
 function setDraft(id:number,patch:Draft){setError("");setDrafts(d=>({...d,[id]:{...d[id],...patch}}));}
 function selectLesson(id:number){if(retryLocked)return;if(dirty){setChangeTarget(id);setDiscard(true);}else{setLessonId(id);setDrafts({});setError("");}}
 function requestClose(){if(saving||retryLocked)return;if(dirty){setChangeTarget(null);setDiscard(true);}else onClose();}
 function nextStudent(e:KeyboardEvent<HTMLInputElement>,index:number){
 
 if(e.ctrlKey||e.metaKey||e.altKey||e.nativeEvent.isComposing)return;
 const letter=e.key.toLocaleLowerCase();
 if(["н","n","о","o"].includes(letter)){
 e.preventDefault();if(e.repeat)return;
 const student=roster[index];if(!student)return;
 const desired=["н","n"].includes(letter)?"absent":"late";
 const current=drafts[student.id]?.attendance??markFor(student.id)?.attendance??"unknown";
 setDraft(student.id,{attendance:current===desired?"unknown":desired});return;
 }
 if(!["Enter","ArrowDown","ArrowUp"].includes(e.key))return;e.preventDefault();

 const input=e.currentTarget;
 if(input.value&&!/^[2-5]$/.test(input.value)){setError("Оценка должна быть от 2 до 5");return;}
 const previous=e.key==="ArrowUp"||(e.key==="Enter"&&e.shiftKey);
 const next=roster[previous?index-1:index+1];
 if(next){const field=fields.current[next.id];field?.focus({preventScroll:true});field?.select();field?.scrollIntoView({block:"nearest",inline:"nearest"});}
 else input.blur();
 }
 async function save(){
 if(!dirty||saving)return;setSaving(true);setError("");
 try{
 const operations=rows.flatMap(row=>[...(row.attendance===undefined?[]:[{lesson_id:lessonId,student_id:row.student_id,operation:"attendance",attendance:row.attendance}]),...(row.grade===undefined?[]:[{lesson_id:lessonId,student_id:row.student_id,operation:"add-grade",grade:row.grade}])]);
 const key=JSON.stringify(operations);if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
 setRetryLocked(true);
 const res=await fetch("/api/journal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"mark-operations",request_id:request.current.id,operations}),signal:AbortSignal.timeout(15000)});
 const body=await res.json();if(!res.ok){if(res.status<500)setRetryLocked(false);else setRetryLocked(true);throw new Error(body.error||"Не удалось сохранить");}
 setRetryLocked(false);
 setDrafts({});
 try{await onSaved(body.marks);onClose();}catch{setError("Данные сохранены. Не удалось обновить журнал — перезагрузите страницу.");}
 }catch(e){setError((e instanceof Error?e.message:"Не удалось сохранить")+". Повторите сохранение — оценки не продублируются.");}finally{setSaving(false);}
 }
 return <><AnimatedDialog label="Быстрое заполнение" wide onClose={requestClose}>
 <header><div><h2>Быстрое заполнение</h2><p className="quick-fill-subtitle">Одна пара · Enter — следующий студент</p></div><button className="icon-button" aria-label="Закрыть быстрое заполнение" disabled={saving||retryLocked} onClick={requestClose}><X/></button></header>
 <div className="quick-fill-controls"><CustomSelect label="Пара для быстрого заполнения" value={String(lessonId)} disabled={saving||retryLocked} onValueChange={v=>selectLesson(Number(v))} options={lessons.map(l=>({value:String(l.id),label:new Date(l.date+"T12:00:00").toLocaleDateString("ru",{day:"numeric",month:"long"})+" · "+l.slot+" пара"+(l.title?" · "+l.title:"")}))}/></div>
 <div className="quick-fill-table-scroll"><table className="quick-fill-table"><thead><tr><th>Студент</th><th>Н</th><th>О</th><th>Оценка</th></tr></thead><tbody>{roster.map((student,index)=>{
 const mark=markFor(student.id),draft=drafts[student.id],attendance=draft?.attendance??mark?.attendance??"unknown";
 return <tr key={student.id}><td><span className="quick-row-number">{String(index+1).padStart(2,"0")}</span>{student.name}</td>
 <td><label className="quick-check absent"><input type="checkbox" disabled={saving||retryLocked} checked={attendance==="absent"} aria-label={"Н: "+student.name} onChange={e=>setDraft(student.id,{attendance:e.target.checked?"absent":"unknown"})}/><span><Check size={15}/></span></label></td>
 <td><label className="quick-check late"><input type="checkbox" disabled={saving||retryLocked} checked={attendance==="late"} aria-label={"О: "+student.name} onChange={e=>setDraft(student.id,{attendance:e.target.checked?"late":"unknown"})}/><span><Check size={15}/></span></label></td>
 <td><div className="quick-grade-field"><input ref={element=>{fields.current[student.id]=element;}} aria-label={"Оценка: "+student.name} autoComplete="off" inputMode="numeric" type="text" pattern="[2-5]" maxLength={1} disabled={saving||retryLocked} placeholder="—" value={draft?.grade??""} onChange={e=>{const value=e.target.value;if(/^[2-5]?$/.test(value))setDraft(student.id,{grade:value});else setError("Оценка должна быть от 2 до 5");}} onKeyDown={e=>nextStudent(e,index)}/>
 {(mark?.grades?.length??0)>0&&<span className="existing-grades" aria-label={"Уже выставлено: "+mark!.grades.join(", ")}>{mark!.grades.map((grade,i)=><span key={i} className={"mark-badge grade-"+grade}>{grade}</span>)}</span>}</div></td></tr>;
 })}</tbody></table>{roster.length===0&&<p className="no-results">На эту дату в группе нет студентов.</p>}</div>
 <div className="quick-fill-bottom">{error&&<p role="alert" className="form-error">{error}</p>}<div className="quick-fill-footer"><span role="status">{dirty?"Изменено строк: "+rows.length:"Новые оценки добавятся к существующим"}</span><div><button className="button secondary" disabled={saving||retryLocked} onClick={requestClose}>Отмена</button><button className="button primary" disabled={!dirty||saving} onClick={save}>{saving?<><LoaderCircle size={16} className="spin"/>Сохраняем…</>:retryLocked?"Повторить сохранение":"Сохранить"}</button></div></div></div>
 </AnimatedDialog>
 <AnimatePresence>{discard&&<AnimatedDialog label="Не сохранять изменения?" onClose={()=>setDiscard(false)}><header><h2>Не сохранять изменения?</h2><button className="icon-button" aria-label="Закрыть подтверждение" onClick={()=>setDiscard(false)}><X/></button></header><p className="form-hint">Введённые в быстром заполнении значения будут потеряны.</p><div className="form-actions"><button className="button secondary" onClick={()=>setDiscard(false)}>Продолжить заполнение</button><button className="button danger" onClick={()=>{setDiscard(false);setDrafts({});setError("");if(changeTarget!==null){setLessonId(changeTarget);setChangeTarget(null);}else onClose();}}>Не сохранять</button></div></AnimatedDialog>}</AnimatePresence>
 </>;
}
