import {useMemo} from "react";
import type {Lesson,Mark,Student} from "@/lib/types";
import {activeOn} from "@/lib/domain.mjs";

export function GradeSheet({lessons,students,marks}:{lessons:Lesson[];students:Student[];marks:Mark[]}){
 const works=useMemo(()=>lessons.filter(l=>l.kind==="independent"),[lessons]);
 const cells=useMemo(()=>new Map(marks.map(m=>[m.lesson_id+":"+m.student_id,m])),[marks]);
 if(!works.length)return <div className="empty"><h2>Табель пока пуст</h2><p>Здесь появятся оценки за самостоятельные работы.</p></div>;
 if(!students.length)return <div className="empty"><h2>В группе пока нет студентов</h2></div>;
 return <div className="table-scroll grade-sheet" tabIndex={0} role="region" aria-label="Табель оценок за самостоятельные работы">
  <table>
   <thead><tr><th className="sheet-number" scope="col">№</th><th className="sheet-name" scope="col">Студент</th>{works.map((work,index)=><th key={work.id} scope="col" title={work.title+" · "+work.date}><abbr aria-label={work.title}>С.р. №{index+1}</abbr></th>)}</tr></thead>
   <tbody>{students.map((student,index)=><tr key={student.id}>
    <td className="sheet-number">{index+1}</td><th className="sheet-name" scope="row">{student.name}</th>
    {works.map(work=>{
     const mark=cells.get(work.id+":"+student.id), grades=mark?.grades??(mark?.grade?[mark.grade]:[]);
     const absent=mark?.attendance==="absent", active=activeOn(student,work.date);
     return <td key={work.id} className={active&&(absent||grades.includes(2))?"sheet-alert":undefined}>{active?[...(absent?["Н"]:[]),...grades].join(" / "):"—"}</td>;
    })}
   </tr>)}</tbody>
  </table>
 </div>;
}
