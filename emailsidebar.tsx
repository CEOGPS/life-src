'use client';

import { Button } from "@/components/ui/button";
import { 
  Users, 
  PlusSquare, 
  Send, 
  Settings, 
  BarChart3, 
  Clock,
  Inbox,
  Star,
  Archive,
  ChevronDown
} from "lucide-react";

const lists = [
  "All Contacts",
  "Leads - Q4",
  "Customers",
  "Newsletter Subscribers",
  "Cold Outreach",
  "Warm Leads"
];

export default function Sidebar({ 
  selectedList, 
  onListSelect,
  activeTab,
  onTabChange
}: { 
  selectedList: string;
  onListSelect: (list: string) => void;
  activeTab: string;
  onTabChange: (tab: any) => void;
}) {
  return (
    <div className="w-64 border-r border-zinc-900 bg-[#0a0a0a] flex flex-col">
      {/* Logo Area */}
      <div className="p-6 border-b border-zinc-900">
        <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
          LifeOS1
        </h1>
        <p className="text-xs text-zinc-600 mt-1">Email OS</p>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 space-y-1">
        <Button 
          variant={activeTab === "contacts" ? "secondary" : "ghost"} 
          className="w-full justify-start"
          onClick={() => onTabChange("contacts")}
        >
          <Users size={18} className="mr-3" />
          Contacts
        </Button>
        <Button 
          variant={activeTab === "builder" ? "secondary" : "ghost"} 
          className="w-full justify-start"
          onClick={() => onTabChange("builder")}
        >
          <PlusSquare size={18} className="mr-3" />
          List Builder
        </Button>
        <Button 
          variant={activeTab === "composer" ? "secondary" : "ghost"} 
          className="w-full justify-start"
          onClick={() => onTabChange("composer")}
        >
          <Send size={18} className="mr-3" />
          Composer
        </Button>
        <Button 
          variant={activeTab === "warmups" ? "secondary" : "ghost"} 
          className="w-full justify-start"
          onClick={() => onTabChange("warmups")}
        >
          <Clock size={18} className="mr-3" />
          Warmups
        </Button>
        <Button 
          variant={activeTab === "accounts" ? "secondary" : "ghost"} 
          className="w-full justify-start"
          onClick={() => onTabChange("accounts")}
        >
          <Settings size={18} className="mr-3" />
          Accounts
        </Button>
        <Button 
          variant={activeTab === "analytics" ? "secondary" : "ghost"} 
          className="w-full justify-start"
          onClick={() => onTabChange("analytics")}
        >
          <BarChart3 size={18} className="mr-3" />
          Analytics
        </Button>
      </div>

      {/* Lists Section */}
      <div className="border-t border-zinc-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Lists
          </span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <PlusSquare size={14} />
          </Button>
        </div>
        <div className="space-y-1">
          {lists.map((list) => (
            <Button
              key={list}
              variant="ghost"
              size="sm"
              className={`w-full justify-start text-sm ${selectedList === list ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
              onClick={() => onListSelect(list)}
            >
              {list === "All Contacts" ? <Inbox size={14} className="mr-2" /> : null}
              {list === "Leads - Q4" ? <Star size={14} className="mr-2" /> : null}
              {list === "Customers" ? <Archive size={14} className="mr-2" /> : null}
              {list}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}