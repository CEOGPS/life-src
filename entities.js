// LifeOS1 — user/auth functions use Firebase directly
import { auth } from "@/lib/firebase";

export const User = {
  me: async () => {
    const u = auth.currentUser;
    if (!u) return null;
    return { id: u.uid, name: u.displayName || "Chris Green", email: u.email, avatar: u.photoURL };
  },
};
