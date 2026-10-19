export function activeOn(student, date) {
 return student.joined_on <= date && (!student.left_on || date < student.left_on);
}
export function studentNames(value) {
 return value.split(/\r?\n/).map(n=>n.trim()).filter(Boolean);
}
export function csvCell(value) {
 return '"' + String(value ?? "").replaceAll('"','""') + '"';
}
