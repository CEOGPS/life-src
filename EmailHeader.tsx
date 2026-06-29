// components/email/EmailHeader.tsx
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, PlusSquare, Send, Settings, BarChart3, Clock } from "lucide-react";

export default function EmailHeader({ 
  title, 
  activeTab, 
  onTabChange 
}: any) {
  return (
    <div className="border-b border-zinc-900 px-8 py-5 bg-[#0a0a0a]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-zinc-500 text-sm">LifeOS1 • Email Operating System</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v: any) => onTabChange(v)}>
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users size={18} /> Contacts
            </TabsTrigger>
            <TabsTrigger value="builder" className="flex items-center gap-2">
              <PlusSquare size={18} /> List Builder
            </TabsTrigger>
            <TabsTrigger value="composer" className="flex items-center gap-2">
              <Send size={18} /> Composer
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Settings size={18} /> Accounts
            </TabsTrigger>
            <TabsTrigger value="warmups" className="flex items-center gap-2">
              <Clock size={18} /> Warmups
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 size={18} /> Analytics
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}