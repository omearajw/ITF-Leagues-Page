import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function AccessPage() {
  async function handleLogin(formData: FormData) {
    'use server';
    const passcode = formData.get('passcode') as string;
    const cookieStore = await cookies();

    // HTTPS-only in production. Not on the local dev server: Safari refuses a Secure cookie on
    // http://localhost, so signing in there would silently fail and the proxy would send you home.
    const secure = process.env.NODE_ENV === 'production';

    if (passcode === process.env.EDITOR_PASSCODE) {
      cookieStore.set('itf_role', process.env.EDITOR_SECRET_TOKEN as string, { 
        httpOnly: true, secure, maxAge: 60 * 60 * 24 * 30 
      });
      redirect('/editor');
    } else if (passcode === process.env.ADMIN_PASSCODE) {
      cookieStore.set('itf_role', process.env.ADMIN_SECRET_TOKEN as string, { 
        httpOnly: true, secure, maxAge: 60 * 60 * 24 * 30 
      });
      redirect('/admin');
    } else {
      redirect('/'); 
    }
  }

  return (
    <div className="max-w-md mx-auto py-20 text-center">
      <h1 className="text-2xl font-bold mb-6">Staff Access</h1>
      <form action={handleLogin} className="flex flex-col gap-4">
        <input 
          type="password" 
          name="passcode" 
          placeholder="Enter Passcode" 
          className="p-3 border rounded text-center"
          required 
        />
        <button type="submit" className="bg-panel text-white py-3 rounded font-bold hover:bg-surface-2">
          Unlock
        </button>
      </form>
    </div>
  );
}