// components/email/views/ContactsView.tsx (Enhanced with segmentation)
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useContacts } from '@/hooks/useContacts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  Trash2, 
  UserCheck, 
  RefreshCw, 
  Download,
  Upload,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  Shield
} from 'lucide-react';

type VerificationFilter = 'all' | 'valid' | 'invalid' | 'catch_all' | 'unknown' | 'spamtrap' | 'abuse';

export default function ContactsView({ selectedList }: { selectedList: string }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    valid: 0,
    invalid: 0,
    catch_all: 0,
    unknown: 0
  });

  useEffect(() => {
    fetchContacts();
  }, [selectedList, search, verificationFilter, categoryFilter]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    
    if (!user.user) return;

    let query = supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.user.id);

    if (selectedList !== 'All Contacts') {
      query = query.eq('list_id', selectedList);
    }

    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,company.ilike.%${search}%`);
    }

    if (verificationFilter !== 'all') {
      query = query.eq('verification_status', verificationFilter);
    }

    if (categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (!error && data) {
      setContacts(data);
      
      // Calculate stats
      const stats = {
        total: data.length,
        valid: data.filter(c => c.verification_status === 'valid').length,
        invalid: data.filter(c => c.verification_status === 'invalid').length,
        catch_all: data.filter(c => c.verification_status === 'catch_all').length,
        unknown: data.filter(c => c.verification_status === 'unknown').length
      };
      setStats(stats);
    }
    
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      valid: { color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle, label: 'Valid' },
      invalid: { color: 'bg-red-500/10 text-red-400', icon: XCircle, label: 'Invalid' },
      catch_all: { color: 'bg-yellow-500/10 text-yellow-400', icon: AlertCircle, label: 'Catch-all' },
      unknown: { color: 'bg-gray-500/10 text-gray-400', icon: HelpCircle, label: 'Unknown' },
      spamtrap: { color: 'bg-red-500/10 text-red-400', icon: Shield, label: 'Spam Trap' },
      abuse: { color: 'bg-orange-500/10 text-orange-400', icon: AlertCircle, label: 'Abuse' }
    };

    const c = config[status as keyof typeof config] || config.unknown;
    const Icon = c.icon;

    return (
      <Badge className={`${c.color} gap-1`}>
        <Icon size={12} />
        {c.label}
      </Badge>
    );
  };

  const handleVerifySelected = async () => {
    if (!confirm(`Verify ${selectedIds.length} contacts? This may take a few minutes.`)) return;

    const response = await fetch('/api/contacts/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: selectedIds })
    });

    if (response.ok) {
      alert('Verification started! Check back in a few minutes.');
      fetchContacts();
      setSelectedIds([]);
    }
  };

  const handleExport = () => {
    const csv = contacts.map(c => ({
      Email: c.email,
      'First Name': c.first_name || '',
      'Last Name': c.last_name || '',
      Company: c.company || '',
      'Job Title': c.job_title || '',
      'Verification Status': c.verification_status,
      Category: c.category,
      'Last Contacted': c.last_contacted_at || ''
    }));

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      csv.map(row => Object.values(row).join(',')).join('\n');
    
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `contacts_${new Date().toISOString()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold">{selectedList}</h2>
          <p className="text-zinc-500 text-sm mt-1">
            {stats.total} total contacts • {stats.valid} verified • {stats.invalid} invalid
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport}>
            <Download size={18} className="mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={fetchContacts}>
            <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-zinc-500" size={18} />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800"
            />
          </div>
        </div>

        <select
          value={verificationFilter}
          onChange={(e) => setVerificationFilter(e.target.value as VerificationFilter)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2"
        >
          <option value="all">All Status</option>
          <option value="valid">✓ Valid</option>
          <option value="invalid">✗ Invalid</option>
          <option value="catch_all">⚠ Catch-all</option>
          <option value="unknown">? Unknown</option>
          <option value="spamtrap">🎯 Spam Trap</option>
          <option value="abuse">🚫 Abuse</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2"
        >
          <option value="all">All Categories</option>
          <option value="customer">Customers</option>
          <option value="lead">Leads</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>

        {selectedIds.length > 0 && (
          <Button onClick={handleVerifySelected} className="bg-violet-600 hover:bg-violet-700">
            <Mail size={18} className="mr-2" />
            Verify Selected ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-zinc-500">Total</p>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-2xl font-bold text-emerald-400">{stats.valid}</p>
          <p className="text-xs text-zinc-500">Valid</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <p className="text-2xl font-bold text-red-400">{stats.invalid}</p>
          <p className="text-xs text-zinc-500">Invalid</p>
        </div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-2xl font-bold text-yellow-400">{stats.catch_all}</p>
          <p className="text-xs text-zinc-500">Catch-all</p>
        </div>
        <div className="bg-gray-500/5 border border-gray-500/20 rounded-lg p-4">
          <p className="text-2xl font-bold text-gray-400">{stats.unknown}</p>
          <p className="text-xs text-zinc-500">Unknown</p>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.length === contacts.length && contacts.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(contacts.map(c => c.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="rounded border-zinc-600"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id} className="hover:bg-zinc-900/50">
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(contact.id)}
                    onChange={() => {
                      setSelectedIds(prev =>
                        prev.includes(contact.id)
                          ? prev.filter(id => id !== contact.id)
                          : [...prev, contact.id]
                      );
                    }}
                    className="rounded border-zinc-600"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {contact.first_name} {contact.last_name}
                </TableCell>
                <TableCell className="font-mono text-sm text-zinc-400">{contact.email}</TableCell>
                <TableCell>{contact.company || '—'}</TableCell>
                <TableCell>{getStatusBadge(contact.verification_status)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {contact.category || 'cold'}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-500 text-sm">
                  {contact.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <UserCheck size={18} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {loading && <div className="p-12 text-center">Loading contacts...</div>}
        {!loading && contacts.length === 0 && (
          <div className="p-20 text-center text-zinc-500">No contacts found</div>
        )}
      </div>
    </div>
  );
}