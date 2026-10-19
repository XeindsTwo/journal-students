export function applyMark(mark, edit) {
 const grades=[...(mark.grades??[])];let attendance=mark.attendance;
 switch(edit.operation){
 case 'add-grade':if(![2,3,4,5].includes(edit.grade))throw Error('Выберите оценку');if(grades.length>=100)throw Error('В одной ячейке уже 100 оценок');grades.push(edit.grade);break;
 case 'remove-grade':if(edit.index===undefined||grades[edit.index]!==edit.grade)throw Error('Оценки изменились. Обновите журнал');grades.splice(edit.index,1);break;
 case 'attendance':case 'toggle-attendance':if(!['unknown','absent','late'].includes(edit.attendance)||(edit.operation==='toggle-attendance'&&edit.attendance==='unknown'))throw Error('Выберите Н или О');attendance=edit.operation==='toggle-attendance'&&attendance===edit.attendance?'unknown':edit.attendance;break;
 case 'clear-grades':grades.length=0;break;
 case 'clear':grades.length=0;attendance='unknown';break;
 default:throw Error('Неизвестное действие');
 }
 return {...mark,grades,grade:grades.at(-1)??null,attendance};
}
