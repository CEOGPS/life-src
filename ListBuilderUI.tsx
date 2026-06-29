// components/email/views/ListBuilderView.tsx (Updated)
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Building2, 
  Users, 
  Target, 
  Upload,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Briefcase,
  MapPin,
  DollarSign
} from 'lucide-react';

export default function ListBuilderView() {
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('people');
  const [formData, setFormData] = useState({
    // ZoomInfo filters
    jobTitle: '',
    seniority: '',
    industry: '',
    company: '',
    location: '',
    minEmployees: 10,
    maxEmployees: 500,
    intentTopics: '',
    limit: 100,
    
    // General
    listName: '',
    tags: '',
    enableEnrichment: true,
    
    // File upload
    file: null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      source: 'zoominfo',
      filters: {
        searchType,
        jobTitle: formData.jobTitle,
        seniority: formData.seniority,
        industry: formData.industry,
        company: formData.company,
        location: formData.location,
        minEmployees: formData.minEmployees,
        maxEmployees: formData.maxEmployees,
        intentTopics: formData.intentTopics,
        limit: formData.limit,
        tags: formData.tags
      },
      listName: formData.listName,
      enrichmentEnabled: formData.enableEnrichment
    };

    const response = await fetch('/api/lists/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    if (result.success) {
      alert(`✅ Success! Imported ${result.imported} contacts. ${result.duplicates} duplicates skipped.`);
    } else {
      alert(`❌ Error: ${result.error}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold">List Builder + Verification</h2>
        <p className="text-zinc-500">Import targeted contacts from ZoomInfo, LinkedIn, or CSV files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-zinc-950 border-zinc-800 p-8">
            <form onSubmit={handleSubmit}>
              {/* Search Type Toggle */}
              <div className="mb-6">
                <Label className="text-zinc-400 mb-2 block">Search Type</Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={searchType === 'people' ? 'default' : 'outline'}
                    onClick={() => setSearchType('people')}
                    className="flex-1"
                  >
                    <Users size={18} className="mr-2" />
                    Find People
                  </Button>
                  <Button
                    type="button"
                    variant={searchType === 'companies' ? 'default' : 'outline'}
                    onClick={() => setSearchType('companies')}
                    className="flex-1"
                  >
                    <Building2 size={18} className="mr-2" />
                    Find Companies
                  </Button>
                  <Button
                    type="button"
                    variant={searchType === 'intent' ? 'default' : 'outline'}
                    onClick={() => setSearchType('intent')}
                    className="flex-1"
                  >
                    <TrendingUp size={18} className="mr-2" />
                    Intent Data
                  </Button>
                </div>
              </div>

              {/* People Search */}
              {searchType === 'people' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-zinc-400 mb-2 block">Job Title</Label>
                      <Input
                        placeholder="e.g., Sales Director, Marketing Manager"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-400 mb-2 block">Seniority Level</Label>
                      <select
                        value={formData.seniority}
                        onChange={(e) => setFormData({...formData, seniority: e.target.value})}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2"
                      >
                        <option value="">Any Seniority</option>
                        <option value="C-Level">C-Level</option>
                        <option value="VP">VP</option>
                        <option value="Director">Director</option>
                        <option value="Manager">Manager</option>
                        <option value="Individual Contributor">Individual Contributor</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-zinc-400 mb-2 block">Company (Optional)</Label>
                    <Input
                      placeholder="Specific company name"
                      value={formData.company}
                      onChange={(e) => setFormData({...formData, company: e.target.value})}
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-zinc-400 mb-2 block">Industry</Label>
                      <Input
                        placeholder="e.g., SaaS, Healthcare, Fintech"
                        value={formData.industry}
                        onChange={(e) => setFormData({...formData, industry: e.target.value})}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-400 mb-2 block">Location</Label>
                      <Input
                        placeholder="e.g., San Francisco, Remote"
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Companies Search */}
              {searchType === 'companies' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-zinc-400 mb-2 block">Industry</Label>
                    <Input
                      placeholder="e.g., Artificial Intelligence, E-commerce"
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-zinc-400 mb-2 block">Min Employees</Label>
                      <Input
                        type="number"
                        value={formData.minEmployees}
                        onChange={(e) => setFormData({...formData, minEmployees: parseInt(e.target.value)})}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-400 mb-2 block">Max Employees</Label>
                      <Input
                        type="number"
                        value={formData.maxEmployees}
                        onChange={(e) => setFormData({...formData, maxEmployees: parseInt(e.target.value)})}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-zinc-400 mb-2 block">Location</Label>
                    <Input
                      placeholder="e.g., United States, Europe"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                </div>
              )}

              {/* Intent Data Search */}
              {searchType === 'intent' && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-zinc-400 mb-2 block">Intent Topics</Label>
                    <Input
                      placeholder="e.g., CRM Migration, Cloud Security, AI (comma separated)"
                      value={formData.intentTopics}
                      onChange={(e) => setFormData({...formData, intentTopics: e.target.value})}
                      className="bg-zinc-900 border-zinc-800"
                    />
                    <p className="text-xs text-zinc-500 mt-1">
                      Find companies actively researching these topics
                    </p>
                  </div>
                </div>
              )}

              {/* Common Fields */}
              <div className="mt-6 pt-6 border-t border-zinc-800 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-zinc-400 mb-2 block">Max Contacts</Label>
                    <Input
                      type="number"
                      value={formData.limit}
                      onChange={(e) => setFormData({...formData, limit: parseInt(e.target.value)})}
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-400 mb-2 block">Tags (comma separated)</Label>
                    <Input
                      placeholder="e.g., SaaS, Enterprise, Q4"
                      value={formData.tags}
                      onChange={(e) => setFormData({...formData, tags: e.target.value})}
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-zinc-400 mb-2 block">Save as List</Label>
                  <Input
                    placeholder="e.g., SaaS Decision Makers - Q4"
                    value={formData.listName}
                    onChange={(e) => setFormData({...formData, listName: e.target.value})}
                    className="bg-zinc-900 border-zinc-800"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enrichment"
                    checked={formData.enableEnrichment}
                    onCheckedChange={(checked) => setFormData({...formData, enableEnrichment: checked as boolean})}
                  />
                  <Label htmlFor="enrichment" className="text-sm text-zinc-400">
                    Enable enrichment (get additional data like direct dials, mobile phones)
                  </Label>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full mt-6 bg-violet-600 hover:bg-violet-700"
                disabled={loading}
              >
                <Sparkles size={18} className="mr-2" />
                {loading ? 'Building list...' : 'Import from ZoomInfo'}
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-zinc-950 border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-violet-400" />
              <h3 className="font-semibold">ZoomInfo Tips</h3>
            </div>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                Use specific job titles for better results
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                Filter by seniority to target decision makers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                Intent data finds companies actively researching
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">✓</span>
                Enable enrichment for direct dials
              </li>
            </ul>
          </Card>

          <Card className="bg-zinc-950 border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-amber-400" />
              <h3 className="font-semibold">Verification Status</h3>
            </div>
            <div className="text-center py-6">
              <p className="text-2xl font-bold">0</p>
              <p className="text-xs text-zinc-500 mt-1">pending verification</p>
              <Button variant="outline" className="mt-4 w-full">
                Verify All Pending
              </Button>
            </div>
          </Card>

          <Card className="bg-gradient-to-r from-violet-600/10 to-blue-600/10 border border-violet-500/20 p-6">
            <div className="flex items-center gap-3 mb-3">
              <DollarSign className="text-violet-400" />
              <h3 className="font-semibold">Pro Tip</h3>
            </div>
            <p className="text-sm text-zinc-300">
              Combine "Intent Data" with "People Search" to find decision makers at companies actively researching your solution.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}