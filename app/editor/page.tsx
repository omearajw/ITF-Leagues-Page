import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export default async function EditorPage() {
  const supabase = await createClient();

  // 1. Fetch all content snippets, ordered alphabetically by title
  const { data: snippets, error } = await supabase
    .from('page_content')
    .select('*')
    .order('title');

  if (error) {
    return <div className="p-8 text-red-500">Failed to load content: {error.message}</div>;
  }

  // 2. The Server Action that handles form submissions
  async function updateSnippet(formData: FormData) {
    'use server'; // This directive tells Next.js to run this securely on the backend
    
    const id = formData.get('id') as string;
    const content = formData.get('content') as string;
    
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('page_content')
      .update({ 
        content: content, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to update:', error);
    }

    // Purge the cache so the dashboard and editor reflect the new text instantly
    revalidatePath('/editor');
    revalidatePath('/'); 
  }

  // 3. Render the CMS UI
  return (
    <div className="max-w-5xl mx-auto py-8">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Content Editor</h1>
        <p className="text-slate-500">Update the write-ups and snippets displayed across the ITF Hub.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {snippets?.map((snippet) => (
          <div key={snippet.id} className="bg-white p-6 rounded-xl border shadow-sm flex flex-col">
            <h2 className="text-lg font-bold text-slate-800 mb-1">{snippet.title}</h2>
            <p className="text-xs text-slate-400 mb-4">
              Last updated: {new Date(snippet.updated_at).toLocaleDateString()}
            </p>
            
            {/* Each snippet gets its own independent form */}
            <form action={updateSnippet} className="flex flex-col flex-grow">
              <input type="hidden" name="id" value={snippet.id} />
              
              <textarea 
                name="content"
                defaultValue={snippet.content}
                className="w-full h-32 p-3 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-sm mb-4"
                placeholder="Write the summary here..."
                required
              />
              
              <button 
                type="submit"
                className="mt-auto bg-slate-900 text-white py-2 px-4 rounded-lg font-medium hover:bg-slate-800 transition"
              >
                Save Changes
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}