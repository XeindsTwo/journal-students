import {useMemo} from "react";
import type {Lesson,Mark,Student} from "@/lib/types";
import {activeOn} from "@/lib/domain.mjs";

export function GradeSheet({lessons,students,marks}:{lessons:Lesson[];students:Student[];marks:Mark[]}){
 const works=useMemo(()=>lessons.filter(l=>l.kind==="independent"||l.kind==="practice"),[lessons]);
 const numbers=new Map<number,number>();let next=0;for(const work of works)if(work.kind==="independent")numbers.set(work.id,++next);
 const cells=useMemo(()=>new Map(marks.map(m=>[m.lesson_id+":"+m.student_id,m])),[marks]);
 if(!works.length)return <div className="empty"><h2>Табель пока пуст</h2><p>Здесь появятся оценки за самостоятельные и практические работы.</p></div>;
 if(!students.length)return <div className="empty"><h2>В группе пока нет студентов</h2></div>;
 return <div className="table-scroll grade-sheet" tabIndex={0} role="region" aria-label="Табель оценок за самостоятельные и практические работы">
  <table>
   <thead><tr><th className="sheet-number" scope="col">№</th><th className="sheet-name" scope="col">Студент</th>{works.map(work=><th key={work.id} scope="col" className={work.kind==="practice"?"practice-column":undefined} title={work.title+" · "+work.date}><abbr aria-label={work.title}>{work.kind==="practice"?"П.р. №"+work.practice_no:"С.р. №"+numbers.get(work.id)}</abbr></th>)}</tr></thead>
   <tbody>{students.map((student,index)=><tr key={student.id}>
    <td className="sheet-number">{index+1}</td><th className="sheet-name" scope="row">{student.name}</th>
    {works.map(work=>{
     const mark=cells.get(work.id+":"+student.id), grades=mark?.grades??(mark?.grade?[mark.grade]:[]);
     const absent=mark?.attendance==="absent", active=activeOn(student,work.date);
     return <td key={work.id} className={active&&(absent||grades.includes(2))?"sheet-alert":undefined} title={active&&mark?.overdue?"Не сдал в срок":undefined}>{active?[...(absent?["Н"]:[]),...grades,...(mark?.overdue?["!"]:[])].join(" / "):"—"}</td>;
    })}
   </tr>)}</tbody>
  </table>
 </div>;
}
