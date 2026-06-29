'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bold, Italic, List, Link, Variable } from "lucide-react";

export default function ComposerView() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Start writing your email here...</p>',
    editorProps: {
      attributes: {
        class: 'prose prose-zinc prose-invert max-w-none focus:outline-none min-h-[400px] p-6',
      },
    },
  });

  const insertVariable = (variable: string) => {
    if (editor) {
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-semibold">New Campaign</h2>

      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-8">
        {/* From & Subject */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-zinc-400 block mb-2">From Account</label>
            <Select defaultValue="ceo@yourcompany.com">
              <SelectTrigger className="bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ceo@yourcompany.com">ceo@yourcompany.com (Gmail)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Subject Line</label>
            <Input 
              placeholder="Enter compelling subject..." 
              className="bg-zinc-900 border-zinc-700 text-lg" 
            />
          </div>
        </div>

        {/* Variables Toolbar */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => insertVariable("first_name")}>
            <Variable size={16} className="mr-2" /> First Name
          </Button>
          <Button variant="outline" size="sm" onClick={() => insertVariable("company")}>
            <Variable size={16} className="mr-2" /> Company
          </Button>
          <Button variant="outline" size="sm" onClick={() => insertVariable("job_title")}>
            <Variable size={16} className="mr-2" /> Job Title
          </Button>
        </div>

        {/* Rich Text Editor */}
        <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900">
          <div className="border-b border-zinc-800 p-3 flex gap-2 bg-zinc-950">
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold size={18} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <Italic size={18} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <List size={18} />
            </Button>
          </div>
          <EditorContent editor={editor} />
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline">Save as Template</Button>
          <Button variant="outline">Send Test</Button>
          <Button size="lg" className="bg-violet-600 hover:bg-violet-700 px-10">
            Send Campaign
          </Button>
        </div>
      </div>
    </div>
  );
}