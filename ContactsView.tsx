'use client';

import { useState } from "react";
import { useContacts } from "@/hooks/useContacts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Trash2, UserCheck, RefreshCw } from "lucide-react";

export default function ContactsView({ selectedList }: { selectedList: string }) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { contacts, isLoading, refetch, deleteContacts, isDeleting } = useContacts(selectedList, search);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (confirm(`Delete ${selectedIds.length} contacts?`)) {
      deleteContacts(selectedIds);
      setSelectedIds([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">{selectedList}</h2>

        <div className="flex items-center gap-4">
          <div className="relative w-80">
            <Search className="absolute left-3 top-3 text-zinc-500" size={18} />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800"
            />
          </div>

          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={18} className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Filter size={18} className="mr-2" /> Filter
          </Button>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900">
              <TableHead className="w-12"><Checkbox /></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id} className="hover:bg-zinc-900/50">
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.includes(contact.id)}
                    onCheckedChange={() => toggleSelect(contact.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {contact.first_name} {contact.last_name}
                </TableCell>
                <TableCell className="font-mono text-sm text-zinc-400">{contact.email}</TableCell>
                <TableCell>{contact.company}</TableCell>
                <TableCell className="text-zinc-400">{contact.job_title}</TableCell>
                <TableCell><Badge variant="secondary">{contact.source}</Badge></TableCell>
                <TableCell>
                  {contact.verified ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400">✓ Verified</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-zinc-500 text-sm">
                  {contact.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm"><UserCheck size={18} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {isLoading && <div className="p-12 text-center">Loading contacts...</div>}
        {!isLoading && contacts.length === 0 && (
          <div className="p-20 text-center text-zinc-500">No contacts found</div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 rounded-2xl px-8 py-4 flex items-center gap-4 shadow-2xl z-50">
          <span className="font-medium">{selectedIds.length} selected</span>
          <Button size="sm" variant="outline">Add to List</Button>
          <Button size="sm" variant="outline">Verify Emails</Button>
          <Button 
            size="sm" 
            variant="destructive" 
            onClick={handleDeleteSelected}
            disabled={isDeleting}
          >
            <Trash2 size={16} className="mr-2" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      )}
    </div>
  );
}