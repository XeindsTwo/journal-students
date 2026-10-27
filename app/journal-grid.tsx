"use client";
import {AddEntryButton} from "./add-entry-button";

import {memo,useMemo,useCallback,useRef,useState} from "react";
import {ListChecks} from "lucide-react";
import {MarkCell,type MarkEdit} from "./mark-cell";
import type {Lesson,Student,Mark} from "@/lib/types";
import {activeOn} from "@/lib/domain.mjs";
type Cell={row:number;column:number};
type Controls={buttons:Map<string,HTMLButtonElement>;focus:(row:number,column:number)=>void;move:(from:Cell,dr:number,dc:number)=>void;edit:(lesson:number,student:number,edit:MarkEdit)=>Promise<unknown>};
const GridCell=memo(function GridCell({mark,student,lesson,row,column,tabIndex,controls}:{mark?:Mark;student:Student;lesson:Lesson;row:number;column:number;tabIndex:number;controls:React.RefObject<Controls>}){
 const cellRef=useCallback((element:HTMLButtonElement|null)=>{const key=row+":"+column;if(element)controls.current.buttons.set(key,element);else controls.current.buttons.delete(key);},[row,column,controls]);
 return <MarkCell isTest={lesson.kind==="test"} mark={mark} disabled={false} label={student.name+", "+lesson.date+(lesson.kind==="test"?", тест "+lesson.title:"")+(mark?.attendance==="absent"?", Н":mark?.attendance==="late"?", О":"")+", оценки "+(mark?.grades?.join(", ")||"не выставлены")} cellRef={cellRef} tabIndex={tabIndex} onFocus={()=>controls.current.focus(row,column)} onNavigate={(dr,dc)=>controls.current.move({row,column},dr,dc)} onEdit={edit=>controls.current.edit(lesson.id,student.id,edit)}/>;
});
export function JournalGrid({lessons,students,marks,onOpenLesson,onQuickFill,onAddLesson,onEditStudent,onEditMark}:{lessons:Lesson[];students:Student[];marks:Mark[];onOpenLesson:(lesson:Lesson)=>void;onQuickFill:(lessonId:number)=>void;onAddLesson:(kind:"lesson"|"test")=>void;onEditStudent:(student:Student)=>void;onEditMark:(lessonId:number,studentId:number,edit:MarkEdit)=>Promise<unknown>}){
 const [selected,setSelected]=useState<Cell|null>(null),[focused,setFocused]=useState(false);
 const buttons=useRef(new Map<string,HTMLButtonElement>());
 const scroll=useRef<HTMLDivElement>(null);
 const markMap=useMemo(()=>new Map(marks.map(mark=>[mark.lesson_id+":"+mark.student_id,mark])),[marks]);
 const controls=useRef<Controls>({buttons:buttons.current,focus:()=>{},move:()=>{},edit:onEditMark});
 controls.current={buttons:buttons.current,focus:(row,column)=>setSelected({row,column}),move,edit:onEditMark};
 const key=(row:number,column:number)=>row+":"+column;
 const active=(row:number,column:number)=>Boolean(students[row]&&lessons[column]&&activeOn(students[row],lessons[column].date));
 const first=useMemo(()=>{for(let row=0;row<students.length;row++)for(let column=0;column<lessons.length;column++)if(activeOn(students[row],lessons[column].date))return {row,column};},[students,lessons]);
 function move(from:Cell,rowStep:number,columnStep:number){
 let row=from.row+rowStep,column=from.column+columnStep;
 while(row>=0&&row<students.length&&column>=0&&column<lessons.length){
 if(active(row,column)){
 const button=buttons.current.get(key(row,column));button?.focus({preventScroll:true});
 if(button&&scroll.current){
 button.scrollIntoView({block:"nearest",inline:"nearest"});
 const viewport=scroll.current.getBoundingClientRect();
 const bounds=button.getBoundingClientRect();
 const pinned=scroll.current.querySelector<HTMLElement>(".student-col")?.getBoundingClientRect().width??0;
 if(bounds.left<viewport.left+pinned)scroll.current.scrollLeft-=viewport.left+pinned-bounds.left;
 }
 return;
 }
 row+=rowStep;column+=columnStep;
 }
 }
 return <div ref={scroll} className="table-scroll journal-grid" onFocusCapture={e=>setFocused(Boolean((e.target as HTMLElement).closest(".mark-cell")))} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setFocused(false);}}>
 <table className="journal-table"><thead><tr><th className="student-col"><span>Студент</span></th>{lessons.map((lesson,column)=><th key={lesson.id} className={lesson.kind==="test"?"test-column":undefined} data-current-column={focused&&selected?.column===column?"true":undefined}><div className="lesson-column-heading"><button className="lesson-head" title={lesson.kind==="test"?lesson.title:undefined} onClick={()=>onOpenLesson(lesson)}><strong>{new Date(lesson.date+"T12:00:00").toLocaleDateString("ru",{day:"numeric",month:"short"})}</strong></button><button className="quick-column-button" aria-label={"Быстрое заполнение: "+lesson.date+", "+(lesson.kind==="test"?"тест "+lesson.title:lesson.slot+" пара")} onClick={()=>onQuickFill(lesson.id)}><ListChecks size={17}/></button></div></th>)}<th><AddEntryButton compact onSelect={onAddLesson}/></th></tr></thead>
 <tbody>{students.map((student,row)=><tr key={student.id}><td className="student-col"><button className="student-name" onClick={()=>onEditStudent(student)}><span className="row-number">{String(row+1).padStart(2,"0")}</span>{student.name}{student.left_on&&<small className="archived">выбыл</small>}</button></td>{lessons.map((lesson,column)=>{
 const mark=markMap.get(lesson.id+":"+student.id);
 return <td key={lesson.id} className={lesson.kind==="test"?"test-column":undefined}>{!active(row,column)?<span className="inactive-mark">—</span>:<GridCell mark={mark} student={student} lesson={lesson} row={row} column={column} controls={controls} tabIndex={(selected?selected.row===row&&selected.column===column:first?.row===row&&first?.column===column)?0:-1}/>}</td>;
 })}<td/></tr>)}</tbody></table>
 {students.length===0&&<p className="no-results">Студенты не найдены. Добавить студентов можно через «Состав группы».</p>}
 </div>;
}

