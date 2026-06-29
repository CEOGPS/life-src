'use client';

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Shield, TrendingUp, Mail } from "lucide-react";

export default function ContextPanel({ activeTab, selectedList }: { activeTab: string; selectedList: string }) {
  const getContent = () => {
    switch (activeTab) {
      case "contacts":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">{selectedList}</h3>
              <p className="text-2xl font-bold">1,247</p>
              <p className="text-xs text-zinc-500">Total contacts</p>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Verified</span>
                <span className="text-emerald-400">892 (71%)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Unverified</span>
                <span>355 (29%)</span>
              </div>
              <div className="h-px bg-zinc-800 my-2" />
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Engaged</span>
                <span className="text-blue-400">423 (34%)</span>
              </div>
            </div>
          </div>
        );
      case "accounts":
        return (
          <div className="space-y-6">
            <h3 className="font-semibold">DNS Health Score</h3>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-400">94</div>
              <p className="text-xs text-zinc-500 mt-1">/100</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>SPF</span>
                <Badge className="bg-emerald-500/10 text-emerald-400">Valid</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>DKIM</span>
                <Badge className="bg-emerald-500/10 text-emerald-400">Valid</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>DMARC</span>
                <Badge variant="outline">Pending</Badge>
              </div>
            </div>
          </div>
        );
      case "composer":
        return (
          <div className="space-y-6">
            <h3 className="font-semibold">Writing Tips</h3>
            <ul className="text-sm text-zinc-400 space-y-3">
              <li>✓ Use personalization tokens</li>
              <li>✓ Keep subject lines under 60 chars</li>
              <li>✓ Include a clear CTA</li>
              <li>✓ Test on mobile devices</li>
            </ul>
            <div className="bg-zinc-900 rounded-lg p-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <TrendingUp size={14} />
                <span className="text-xs">Avg open rate: 42%</span>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center text-zinc-500 text-sm">
            Select a section to see insights
          </div>
        );
    }
  };

  return (
    <Card className="bg-zinc-950/50 border-zinc-800 p-5">
      <div className="flex items-center gap-2 mb-6">
        <Activity size={16} className="text-violet-400" />
        <span className="text-sm font-medium">Insights</span>
      </div>
      {getContent()}
    </Card>
  );
}