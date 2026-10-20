import {requireOwner} from "@/lib/auth";
import JournalApp from "../../journal-app";
import {notFound} from "next/navigation";
export default async function JournalPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 await requireOwner("/journals/"+id);
 if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<1)notFound();
 return <JournalApp activeJournalId={Number(id)}/>;
}
