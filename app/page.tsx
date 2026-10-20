import JournalApp from './journal-app';
import {requireOwner} from '@/lib/auth';
export default async function Page(){await requireOwner();return <JournalApp/>;}
