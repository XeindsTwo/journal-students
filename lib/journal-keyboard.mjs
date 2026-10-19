export function journalKeyAction(event){
 if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return null;
 const key=event.key;
 if(key==="ArrowUp")return {kind:"move",row:-1,column:0};
 if(key==="ArrowDown"||key==="Enter")return {kind:"move",row:key==="Enter"&&event.shiftKey?-1:1,column:0};
 if(key==="ArrowLeft")return {kind:"move",row:0,column:-1};
 if(key==="ArrowRight")return {kind:"move",row:0,column:1};
 if(key==="Escape")return {kind:"escape"};
 if(event.repeat)return null;
 if(!event.shiftKey&&/^[2-5]$/.test(key))return {kind:"grade",grade:Number(key)};
 const letter=key.toLocaleLowerCase();
 if(letter==="н"||letter==="n")return {kind:"attendance",attendance:"absent"};
 if(letter==="о"||letter==="o")return {kind:"attendance",attendance:"late"};
 return null;
}
