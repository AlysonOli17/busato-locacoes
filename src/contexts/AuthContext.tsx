import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { nome: string; email: string; status: string } | null;
  role: string | null;
  permissions: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    try {
      const [profileRes, roleRes, permRes] = await Promise.all([
        supabase.from("profiles").select("nome, email, status").eq("user_id", userId).single(),
        supabase.rpc("get_user_role", { _user_id: userId }),
        supabase.rpc("get_user_permissions", { _user_id: userId }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (roleRes.data) setRole(roleRes.data as string);
      if (permRes.data) setPermissions(permRes.data as string[]);
    } catch (err) {
      console.error("Error loading user data:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Use setTimeout to avoid Supabase auth deadlock
        setTimeout(async () => {
          if (!mounted) return;
          await loadUserData(session.user.id);
          if (mounted) setLoading(false);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Check profile status
    const { data: prof } = await supabase.from("profiles").select("status").eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "").single();
    if (prof && prof.status !== "Ativo") {
      await supabase.auth.signOut();
      return { error: prof.status === "Pendente" ? "Seu acesso ainda está pendente de aprovação." : "Seu acesso foi bloqueado. Contate o administrador." };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, permissions, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
