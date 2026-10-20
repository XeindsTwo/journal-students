"use client";
import {LogoutButton} from "./logout-button";
import {JournalSkeleton} from "./journal-skeleton";
import {useMarkSync,markQueue} from "./mark-sync";
import {useEffect,useRef,useState,useMemo,useCallback} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {DatePicker} from "./date-picker";
import {QuickFill} from "./quick-fill";
import {BookOpen,BookOpenCheck,ListChecks,Plus,Users,LayoutGrid,List,ChevronRight,X,Check,ArrowUpRight,LoaderCircle,Trash2} from "lucide-react";
import {AnimatePresence,MotionConfig,motion,useReducedMotion} from "motion/react";
import {AnimatedDialog,CustomSelect} from "./ui";
import type {Data,Lesson,Student} from "@/lib/types";
import {studentNames} from "@/lib/domain.mjs";
import {JournalGrid} from "./journal-grid";
import type {MarkEdit} from "./mark-cell";
import {TagBadge,tagStyle} from "./tag-badge";

const empty:Data={groups:[],students:[],journals:[],lessons:[],marks:[]};
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const yearStart=()=>{const d=new Date();return `${d.getMonth()<8?d.getFullYear()-1:d.getFullYear()}-09-01`};
const shortDate=(d:string)=>new Date(d+"T12:00:00").toLocaleDateString("ru",{day:"numeric",month:"short"});
const suggestedTags=["Дистант","Самостоятельная","Практика за компьютером","Лекция","Контрольная"];
type Modal="group"|"journal"|"lesson"|"students"|null;
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>}
function Empty({title,text,children}:{title:string;text:string;children?:React.ReactNode}){return <div className="empty"><div className="empty-icon"><BookOpen size={32}/></div><h2>{title}</h2><p>{text}</p>{children}</div>}

export default function JournalApp({activeJournalId}:{activeJournalId?:number}){
 const reduced=useReducedMotion();
 const markSync=useMarkSync();
 const editMark=useCallback((lesson_id:number,student_id:number,edit:MarkEdit)=>{const message=markQueue.enqueue({lesson_id,student_id,...edit});if(message)setError(message);return Promise.resolve();},[]);
 const router=useRouter();
 const mutationQueue=useRef<Promise<unknown>>(Promise.resolve());
 const pendingMutations=useRef(0);
 useEffect(()=>{
 const root=document.documentElement;root.dataset.inputMode="pointer";
 const pointer=()=>{root.dataset.inputMode="pointer";};
 const keyboard=(event:globalThis.KeyboardEvent)=>{if(!["Shift","Control","Alt","Meta"].includes(event.key)&&!event.ctrlKey&&!event.metaKey&&!event.altKey)root.dataset.inputMode="keyboard";};
 document.addEventListener("pointerdown",pointer,true);document.addEventListener("keydown",keyboard,true);
 return()=>{document.removeEventListener("pointerdown",pointer,true);document.removeEventListener("keydown",keyboard,true);};
 },[]);
 const [confirmation,setConfirmation]=useState<{title:string;description:string;action:()=>void|Promise<void>}|null>(null);
 const [data,setData]=useState<Data>(empty),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false),[saved,setSaved]=useState("");
 const [connected,setConnected]=useState(false);
 const [groupId,setGroupId]=useState<number|null>(null);
 const [view,setView]=useState<"table"|"list">("table"),[modal,setModal]=useState<Modal>(null),[selected,setSelected]=useState<Lesson|null>(null),[dirty,setDirty]=useState(false);
 const [editingStudent,setEditingStudent]=useState<Student|null>(null);
 const [quickLessonId,setQuickLessonId]=useState<number|null>(null);
 async function reload(){const revision=markQueue.revision;const r=await fetch("/api/journal",{cache:"no-store"});const d=await r.json();if(!r.ok){if(r.status===401)throw new Error("Сессия завершена. Войди в журнал снова.");setConnected(false);throw new Error(d.error);}setConnected(true);if(markQueue.revision===revision)markQueue.hydrate(d.marks);setData(d);return d as Data;}
 useEffect(()=>{reload().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 const journal=activeJournalId===undefined?undefined:data.journals.find(j=>j.id===activeJournalId);
 const group=activeJournalId!==undefined?data.groups.find(g=>g.id===journal?.group_id):(data.groups.find(g=>g.id===groupId)??data.groups[0]);
 useEffect(()=>{document.title=journal&&group?`${group.name} · ${journal.short_name} — Электронный журнал`:"Электронный журнал";},[journal,group]);
 useEffect(()=>{const refresh=()=>{if(markQueue.busy)return;reload().catch(e=>setError(e.message));};window.addEventListener("focus",refresh);return()=>window.removeEventListener("focus",refresh);},[]);
 const lessons=useMemo(()=>data.lessons.filter(l=>l.journal_id===journal?.id),[data.lessons,journal?.id]);
 const roster=useMemo(()=>data.students.filter(s=>s.group_id===group?.id),[data.students,group?.id]);
 const students=roster;
 const shownLessons=lessons;
 function requestDiscard(action:()=>void){if(dirty){setConfirmation({title:"Не сохранять изменения?",description:"Несохранённые подробности занятия будут потеряны.",action});}else action();}

 function mutate(payload:object):Promise<any>{
 pendingMutations.current+=1;setBusy(true);
 const task=mutationQueue.current.then(async()=>{
 setError("");setSaved("");
 try{await markQueue.drain();const r=await fetch("/api/journal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await r.json();if(!r.ok)throw new Error(result.error);await reload();setSaved("Все изменения сохранены");return result;}
 catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить");return null;}
 finally{pendingMutations.current-=1;setBusy(pendingMutations.current>0);}
 });
 mutationQueue.current=task.then(()=>undefined,()=>undefined);
 return task;
 }
 async function submit(e:React.FormEvent<HTMLFormElement>){
 e.preventDefault();const f=new FormData(e.currentTarget);const val=(n:string)=>String(f.get(n)??"");
 let p:object={};
 if(modal==="group")p={action:"group",name:val("name"),names:studentNames(val("names")),joined_on:val("joined_on")};
 if(modal==="journal")p={action:"journal",group_id:Number(val("group_id")),name:val("name"),short_name:val("short_name"),period:val("period")};
 if(modal==="students")p={action:"students",group_id:group?.id,names:studentNames(val("names")),joined_on:val("joined_on")};
 if(modal==="lesson")p={action:"lesson",journal_id:journal?.id,date:val("date"),slot:Number(val("slot")),title:val("title")};
 const result=await mutate(p);
 if(result){if(modal==="journal")setGroupId(Number(val("group_id")));if(modal==="group")setGroupId(result.id);
 if(modal==="lesson"){const d=await reload();setSelected(d.lessons.find(l=>l.id===result.id)??null);setDirty(false);}
 setModal(null);}
 }
 async function openQuickFill(id:number){try{await markQueue.drain();setQuickLessonId(id);}catch{setError("Сначала повторите сохранение отметок");}}
 function openLesson(l:Lesson){requestDiscard(()=>{setSelected({...l,tags:[...l.tags]});setDirty(false);});}
 function closeLesson(){requestDiscard(()=>{setSelected(null);setDirty(false);});}
 function updateLesson(p:Partial<Lesson>){setSelected(s=>s?{...s,...p}:s);setDirty(true);}
 return <MotionConfig reducedMotion="user"><div className={activeJournalId===undefined?"app catalog-app":"app journal-app"}>


 {activeJournalId===undefined&&<header className="topbar"><a className="site-title" href="/"><BookOpenCheck size={27} className="site-logo" aria-hidden="true"/>Электронный журнал</a><div className="topbar-actions"><LogoutButton/><button className="button secondary" onClick={()=>setModal("group")}><Plus size={18}/> Новая группа</button></div></header>}
 <motion.main initial={{opacity:0,y:reduced?0:10}} animate={{opacity:1,y:0}} transition={{duration:.325}}>
 {activeJournalId===undefined&&<div className="heading"><h1>Группы</h1></div>}
 {markSync.error&&<div role="alert" className="error">{markSync.error} · Изменения пока не сохранены.<button onClick={markSync.retry}>Повторить сохранение</button></div>}
 {error&&<div role="alert" className="error">{error}<button onClick={()=>{setError("");reload().catch(e=>setError(e.message))}}>Повторить</button></div>}
 {activeJournalId===undefined&&<div className="group-catalog">{loading?<JournalSkeleton catalog/>:data.groups.length===0?<Empty title="Добавь первую группу" text="Создай группу и её предметы. Выбери предмет, чтобы открыть журнал."><button className="button primary" onClick={()=>setModal("group")}><Plus size={18}/> Создать группу</button></Empty>:data.groups.map(g=>{const subjects=data.journals.filter(j=>j.group_id===g.id);return <motion.section className="catalog-group" key={g.id} initial={{opacity:0,y:reduced?0:12}} animate={{opacity:1,y:0}} transition={{duration:.275}}>
 <div className="section-heading"><div>{subjects.length?<a className="group-link" href={"/journals/"+subjects[0].id} title="Открыть первый предмет группы"><h2>{g.name}</h2><ArrowUpRight size={20}/></a>:<h2>{g.name}</h2>}</div><div className="catalog-actions"><button className="text-button" onClick={()=>{setGroupId(g.id);setModal("students");}}><Users size={18}/> Состав группы</button><button className="text-button" onClick={()=>{setGroupId(g.id);setModal("journal");}}><Plus size={18}/> Добавить предмет</button></div></div>
 <div className="subject-grid">{subjects.map(j=><motion.a key={j.id} className="subject-card" href={"/journals/"+j.id} whileHover={reduced?undefined:{y:-1}} whileTap={reduced?undefined:{scale:.995}}>
 <div className="subject-top"><span className="subject-icon"><BookOpen size={20}/></span><ArrowUpRight size={18}/></div><strong>{j.short_name}</strong><span className="subject-full-name">{j.name}</span><span className="subject-period">{j.period}</span></motion.a>)}
 <button className="subject-card add-subject" onClick={()=>{setGroupId(g.id);setModal("journal");}}><span className="add-subject-icon"><Plus size={24}/></span><span>Новый предмет</span></button></div></motion.section>;})}</div>}
 {activeJournalId!==undefined&&
 <AnimatePresence mode="wait" initial={false}><motion.section className="journal-panel" key={journal?.id??group?.id??"empty"} initial={reduced?{opacity:0}:{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-6}} transition={{duration:.225}}>
 {journal&&<div className="journal-heading"><div className="journal-identity"><div className="journal-title-row"><h1>{journal.short_name}</h1><span className="group-caption">Группа {group?.name}</span></div><p>{journal.name}</p><div className="journal-subject-switch"><CustomSelect label="Переключить предмет" value={String(journal.id)} options={data.journals.filter(j=>j.group_id===journal.group_id).map(j=>({value:String(j.id),label:j.short_name+" · "+j.name}))} onValueChange={v=>{if(Number(v)!==journal.id)requestDiscard(()=>{setSelected(null);setDirty(false);setQuickLessonId(null);router.replace("/journals/"+v,{scroll:false});});}}/><Link className="text-button" href="/" scroll={false}><LayoutGrid size={17}/> Все группы</Link></div></div><div className="heading-actions"><LogoutButton/><button className="button secondary" onClick={()=>setModal("students")}><Users size={18}/> Состав группы</button><button className="button primary" onClick={()=>setModal("lesson")}><Plus size={20}/> Добавить пару</button></div></div>}
 {journal&&<><div className="panel-toolbar"><div className="tabs"><button className={view==="table"?"selected":""} onClick={()=>{setView("table")}}><LayoutGrid size={18}/> Журнал</button><button className={view==="list"?"selected":""} onClick={()=>{setView("list")}}><List size={20}/> Занятия</button></div><div className="table-tools"><button className="button secondary quick-fill-trigger" disabled={!lessons.length||busy||markSync.busy} onClick={()=>openQuickFill(lessons.at(-1)!.id)}><ListChecks size={18}/> Быстрое заполнение</button><span role="status" className="save-state">{busy||markSync.saving?<><LoaderCircle size={16} className="spin"/> Сохраняем…</>:<><Check size={16}/>{markSync.error?"Не сохранено":saved||(connected?"Сохранено":"Нет подключения")}</>}</span></div></div></>}
 <AnimatePresence mode="wait" initial={false}><motion.div className="journal-content" key={view} initial={{opacity:0,y:reduced?0:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reduced?0:-8}} transition={{duration:.245}}>
 {loading?<JournalSkeleton/>:!journal?<Empty title="Журнал не найден" text="Возможно, этот журнал больше не существует."><a href="/" className="button secondary">Все группы</a></Empty>:!lessons.length?<Empty title="Здесь появятся твои пары" text="Добавь занятие, отметь отсутствующих, а тему и подробности заполни, когда будет удобно."><button className="button primary" onClick={()=>setModal("lesson")}><Plus size={17}/> Добавить первую пару</button></Empty>:view==="table"?<JournalGrid lessons={shownLessons} students={students} marks={markSync.marks} onOpenLesson={openLesson} onQuickFill={openQuickFill} onAddLesson={()=>setModal("lesson")} onEditStudent={setEditingStudent} onEditMark={editMark}/>:<div className="lesson-list">{shownLessons.map(l=><button className="lesson-card" key={l.id} onClick={()=>openLesson(l)}><span className="date-tile"><strong>{l.date.slice(8)}</strong>{new Date(l.date+"T12:00").toLocaleDateString("ru",{month:"short"})}</span><div className="lesson-card-content"><small>{l.slot} пара</small><h3>{l.title||"Без темы — можно заполнить позже"}</h3><div className="tag-row">{l.tags.map(t=><TagBadge key={t} name={t}/>)}</div></div><ArrowUpRight size={18}/></button>)}{!shownLessons.length&&<p className="no-results">По этому фильтру занятий нет.</p>}</div>}
 </motion.div></AnimatePresence>

 </motion.section></AnimatePresence>}</motion.main>
 <AnimatePresence>{quickLessonId!==null&&<QuickFill key={"quick-"+quickLessonId} initialLessonId={quickLessonId} lessons={lessons} students={roster} marks={markSync.marks} onSaved={async marks=>{markQueue.merge(marks);setSaved("Все изменения сохранены");}} onClose={()=>setQuickLessonId(null)}/>}</AnimatePresence>
 <AnimatePresence>{modal&&<AnimatedDialog key={modal} label={{group:"Новая группа",journal:"Новый журнал",lesson:"Добавить пару",students:"Состав группы"}[modal]} onClose={()=>{if(!busy)setModal(null)}}><header><div><h2 id="modal-title">{{group:"Новая группа",journal:"Новый журнал",lesson:"Добавить пару",students:"Состав группы"}[modal]}</h2></div><button className="icon-button" aria-label="Закрыть" disabled={busy} onClick={()=>setModal(null)}><X/></button></header><form autoComplete="off" onSubmit={submit}>
 {modal==="group"&&<><Field label="Название группы"><input autoComplete="off" name="name" placeholder="ИС-3" required maxLength={200}/></Field><Field label="Студенты — каждый с новой строки"><textarea autoComplete="off" name="names" rows={7} placeholder={"Иванов Иван\nПетрова Анна"}/></Field><Field label="В составе группы с"><DatePicker label="В составе группы с" name="joined_on" defaultValue={yearStart()}/></Field></>}
 {modal==="journal"&&<><Field label="Группа"><CustomSelect name="group_id" label="Группа предмета" defaultValue={String(group?.id??"")} options={data.groups.map(g=>({value:String(g.id),label:g.name}))}/></Field><Field label="Полное название предмета"><input autoComplete="off" name="name" required placeholder="Профессиональный модуль 05" maxLength={200}/></Field><div className="form-row"><Field label="Короткое название"><input autoComplete="off" name="short_name" required placeholder="ПМ.05" maxLength={40}/></Field><Field label="Учебный год / период"><input autoComplete="off" name="period" required defaultValue={`${yearStart().slice(0,4)}–${Number(yearStart().slice(0,4))+1}`}/></Field></div></>}
 {modal==="lesson"&&<><div className="form-row"><Field label="Дата"><DatePicker label="Дата пары" name="date" defaultValue={today()}/></Field><Field label="Номер пары"><input autoComplete="off" name="slot" type="number" min={1} max={12} defaultValue={Math.min(12,Math.max(0,...lessons.filter(l=>l.date===today()).map(l=>l.slot))+1)} required/></Field></div><Field label="Тема · можно позже"><input autoComplete="off" name="title" placeholder="Что сегодня изучаем?" maxLength={300}/></Field></>}
 {modal==="students"&&<><p className="form-hint">Группа {group?.name}. Изменения состава будут видны во всех её предметах.</p><div className="roster-list">{roster.map(s=><button type="button" key={s.id} onClick={()=>setEditingStudent(s)}>{s.name}<ChevronRight size={14}/></button>)}</div><Field label="Добавить студентов — каждый с новой строки"><textarea autoComplete="off" name="names" rows={4} required placeholder="Вставь список из таблицы"/></Field><Field label="В составе группы с"><DatePicker label="В составе группы с" name="joined_on" defaultValue={today()}/></Field></>}
 {error&&<p role="alert" className="form-error">{error}</p>}
 <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setModal(null)}>Отмена</button><button disabled={busy} className="button primary">{busy?"Сохраняем…":modal==="lesson"?"Создать пару":modal==="students"?"Добавить студентов":"Создать"}</button></div></form></AnimatedDialog>}</AnimatePresence>
 <AnimatePresence>{selected&&<AnimatedDialog key="lesson-drawer" drawer label="Карточка занятия" onClose={closeLesson}><header><div><div className="eyebrow">{journal?.short_name} / {group?.name}</div><h2>Карточка занятия</h2></div><button className="icon-button" aria-label="Закрыть занятие" onClick={closeLesson}><X/></button></header><div className="drawer-body"><form autoComplete="off" onSubmit={async e=>{e.preventDefault();if(await mutate({action:"lesson-update",...selected})){setDirty(false);}}}>
 <div className="form-row"><Field label="Дата"><DatePicker label="Дата занятия" value={selected.date} onChange={date=>updateLesson({date})}/></Field><Field label="Номер пары"><input autoComplete="off" type="number" required min={1} max={12} value={selected.slot} onChange={e=>updateLesson({slot:Number(e.target.value)})}/></Field></div>
 <Field label="Тема занятия"><input autoComplete="off" value={selected.title} maxLength={300} placeholder="Добавь тему занятия" onChange={e=>updateLesson({title:e.target.value})}/></Field>
 <Field label="Что прошли"><textarea autoComplete="off" rows={4} value={selected.description} maxLength={20000} placeholder="Основные вопросы, задания, заметки на следующую пару…" onChange={e=>updateLesson({description:e.target.value})}/></Field>
 <div className="field"><span>Теги · можно выбрать несколько</span><div className="tag-options">{[...new Set([...suggestedTags,...selected.tags])].map(t=>{const {Icon,tone}=tagStyle(t);return <button type="button" key={t} aria-pressed={selected.tags.includes(t)} className={`tag tone-${tone} ${selected.tags.includes(t)?"chosen":""}`} onClick={()=>updateLesson({tags:selected.tags.includes(t)?selected.tags.filter(x=>x!==t):[...selected.tags,t]})}><Icon size={16}/>{t}{selected.tags.includes(t)&&<Check size={16}/>}</button>;})}</div><input autoComplete="off" placeholder="Свой тег → Enter" maxLength={50} aria-label="Свой тег" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const t=e.currentTarget.value.trim();if(t&&!selected.tags.includes(t))updateLesson({tags:[...selected.tags,t]});e.currentTarget.value=""}}}/></div>
 <button className="button primary full" disabled={busy||!dirty}>{busy?"Сохраняем…":dirty?"Сохранить подробности":"Подробности сохранены"}</button></form>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <button className="delete-button" disabled={busy} onClick={()=>setConfirmation({title:"Удалить занятие?",description:"Пара, оценки и отметки посещаемости этого занятия будут удалены.",action:async()=>{if(await mutate({action:"delete-lesson",id:selected.id})){setSelected(null);setDirty(false);}}})}><Trash2 size={15}/> Удалить занятие</button>
 </div></AnimatedDialog>}</AnimatePresence>
 <AnimatePresence>{editingStudent&&<AnimatedDialog key="student-dialog" label="Редактирование студента" onClose={()=>{if(!busy)setEditingStudent(null)}}><header><h2>Студент</h2><button className="icon-button" aria-label="Закрыть" onClick={()=>setEditingStudent(null)}><X/></button></header><form autoComplete="off" onSubmit={async e=>{e.preventDefault();if(await mutate({action:"student",...editingStudent}))setEditingStudent(null);}}><Field label="Фамилия и имя"><input autoComplete="off" required value={editingStudent.name} onChange={e=>setEditingStudent({...editingStudent,name:e.target.value})}/></Field><Field label="В группе с"><DatePicker label="В группе с" value={editingStudent.joined_on} onChange={date=>setEditingStudent({...editingStudent,joined_on:date})}/></Field><p className="form-hint">Имя обновится во всех предметах. Старые отметки сохранятся.</p>{error&&<p className="form-error">{error}</p>}<button disabled={busy} className="button primary full">Сохранить</button></form></AnimatedDialog>}</AnimatePresence>
 <AnimatePresence>{confirmation&&<AnimatedDialog key="confirmation" label={confirmation.title} onClose={()=>setConfirmation(null)}><header><h2>{confirmation.title}</h2><button className="icon-button" aria-label="Закрыть" onClick={()=>setConfirmation(null)}><X/></button></header><p className="form-hint">{confirmation.description}</p><div className="form-actions"><button className="button secondary" onClick={()=>setConfirmation(null)}>Отмена</button><button className="button danger" onClick={()=>{const action=confirmation.action;setConfirmation(null);void action();}}>Подтвердить</button></div></AnimatedDialog>}</AnimatePresence>
 </div></MotionConfig>;
}

