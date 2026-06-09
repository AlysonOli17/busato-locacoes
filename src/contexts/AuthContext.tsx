import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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

  // Ref para rastrear o ID do usuário atual dentro de callbacks (evita stale closure)
  // Diferente do estado, o ref é sempre atualizado e lido corretamente dentro de closures
  const currentUserIdRef = useRef<string | null>(null);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      const newUserId = session?.user?.id ?? null;

      // CORREÇÃO DEFINITIVA: usa o ref (sempre atualizado) em vez do estado (closure desatualizado)
      // O Supabase dispara TOKEN_REFRESHED ao voltar de outra aba/janela do navegador.
      // Com o ref, conseguimos detectar que é o mesmo usuário e ignorar completamente o evento,
      // evitando qualquer rerenderização ou recarga de dados da página.
      if (currentUserIdRef.current && newUserId === currentUserIdRef.current && event !== "SIGNED_OUT") {
        // Apenas atualiza a sessão silenciosamente, sem recarregar nada
        setSession(session);
        return;
      }

      // Atualiza o ref com o novo ID
      currentUserIdRef.current = newUserId;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setLoading(true);
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
      currentUserIdRef.current = session?.user?.id ?? null;
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
    currentUserIdRef.current = null;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, permissions, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
