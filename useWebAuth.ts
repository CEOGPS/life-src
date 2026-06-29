import { supabase } from '../../lib/supabaseClient';

export function useWebAuth() {
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) console.error('OAuth Error:', error.message);
  };

  return { loginWithGoogle };
}
