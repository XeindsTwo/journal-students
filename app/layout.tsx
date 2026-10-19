import type {Metadata} from "next";
import "@fontsource-variable/inter";
import "react-day-picker/style.css";
import "./globals.css";
export const metadata:Metadata={title:"Электронный журнал",description:"Занятия, посещаемость и заметки преподавателя"};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="ru"><body>{children}</body></html>}



