export type Group = {id:number;name:string};
export type Student = {id:number;group_id:number;name:string;joined_on:string;left_on:string|null};
export type Journal = {id:number;group_id:number;name:string;short_name:string;period:string};
export type Lesson = {id:number;journal_id:number;date:string;slot:number|null;kind:"lesson"|"test";title:string;description:string;tags:string[];attendance_checked:boolean};
export type Mark = {kind?:"lesson"|"test";lesson_id:number;student_id:number;attendance:"unknown"|"present"|"absent"|"late";grade:number|null;grades:number[]};
export type Data = {groups:Group[];students:Student[];journals:Journal[];lessons:Lesson[];marks:Mark[]};


