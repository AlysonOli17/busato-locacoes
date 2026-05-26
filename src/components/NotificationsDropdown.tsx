import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, X, AlertCircle, ClipboardList, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  referencia_tipo: string | null;
  referencia_id: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast push notification (aparece no canto inferior direito)
// ─────────────────────────────────────────────────────────────────────────────
interface ToastNotif {
  id: string;
  titulo: string;
  mensagem: string;
}

let toastListeners: ((n: ToastNotif) => void)[] = [];
export function pushToastNotification(n: ToastNotif) {
  toastListeners.forEach((fn) => fn(n));
}

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<(ToastNotif & { visible: boolean })[]>([]);

  useEffect(() => {
    const handler = (n: ToastNotif) => {
      const item = { ...n, visible: true };
      setToasts((prev) => [...prev, item]);
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === n.id ? { ...t, visible: false } : t)));
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== n.id)), 400);
      }, 5000);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter((fn) => fn !== handler); };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 bg-card border border-border shadow-2xl rounded-xl px-4 py-3 max-w-xs transition-all duration-300",
            t.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="mt-0.5 h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{t.titulo}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.mensagem}</p>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pop-up de boas-vindas (exibido ao entrar no sistema com notificações não lidas)
// ─────────────────────────────────────────────────────────────────────────────
interface WelcomePopupProps {
  notificacoes: Notificacao[];
  onClose: () => void;
  onMarkAll: () => void;
  onNavigate: () => void;
}

function WelcomePopup({ notificacoes, onClose, onMarkAll, onNavigate }: WelcomePopupProps) {
  const unread = notificacoes.filter((n) => !n.lida);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header com gradiente */}
        <div className="relative bg-gradient-to-br from-accent/20 via-accent/10 to-transparent px-6 pt-6 pb-4 border-b border-border/60">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center shadow-sm">
              <Bell className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Você tem alertas!</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {unread.length} {unread.length === 1 ? "notificação não lida" : "notificações não lidas"}
              </p>
            </div>
          </div>
        </div>

        {/* Lista de notificações não lidas (máx 5) */}
        <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
          {unread.slice(0, 5).map((n) => (
            <div key={n.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
              <div className="mt-0.5 h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                {n.tipo === "etapa" ? (
                  <ClipboardList className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{n.titulo}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{timeAgoFn(n.created_at)}</p>
              </div>
              <span className="mt-2 h-2 w-2 rounded-full bg-accent shrink-0" />
            </div>
          ))}
          {unread.length > 5 && (
            <div className="px-5 py-2 text-xs text-muted-foreground text-center">
              + {unread.length - 5} mais notificações
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border/60 bg-muted/10">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onMarkAll}>
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Marcar todas como lidas
          </Button>
          <Button
            size="sm"
            className="ml-auto text-xs gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={() => { onNavigate(); onClose(); }}
          >
            Ver Agenda <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function timeAgoFn(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown principal
// ─────────────────────────────────────────────────────────────────────────────
export const NotificationsDropdown = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeShown = useRef(false);

  const fetchNotificacoes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      setNotificacoes(data as Notificacao[]);
      // Mostrar popup na primeira carga se houver não lidas
      if (!welcomeShown.current) {
        welcomeShown.current = true;
        const unread = (data as Notificacao[]).filter((n) => !n.lida);
        if (unread.length > 0) {
          setTimeout(() => setShowWelcome(true), 800);
        }
      }
    }
  };

  useEffect(() => {
    fetchNotificacoes();

    if (!user) return;
    const channel = supabase
      .channel("notificacoes-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notificacoes",
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        fetchNotificacoes();
        // Toast push notification
        if (payload.new) {
          pushToastNotification({
            id: payload.new.id,
            titulo: payload.new.titulo,
            mensagem: payload.new.mensagem,
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  const markAsRead = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notificacoes").update({ lida: true }).eq("user_id", user.id).eq("lida", false);
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const deleteNotif = async (id: string) => {
    await supabase.from("notificacoes").delete().eq("id", id);
    setNotificacoes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <>
      {/* Pop-up de boas vindas */}
      {showWelcome && (
        <WelcomePopup
          notificacoes={notificacoes}
          onClose={() => setShowWelcome(false)}
          onMarkAll={() => { markAllRead(); setShowWelcome(false); }}
          onNavigate={() => navigate("/agenda")}
        />
      )}

      {/* Bell button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", unreadCount > 0 && "animate-pulse-once")}
          >
            <Bell className={cn("h-5 w-5 transition-colors", unreadCount > 0 && "text-accent")} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-bounce">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              Notificações
              {unreadCount > 0 && (
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </h4>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
                <CheckCheck className="h-3 w-3 mr-1" /> Marcar todas
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {notificacoes.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sem notificações</p>
              </div>
            ) : (
              notificacoes.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                    !n.lida && "bg-accent/5 border-l-2 border-l-accent"
                  )}
                >
                  <div className="mt-0.5 h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    {n.tipo === "etapa" ? (
                      <ClipboardList className="h-3.5 w-3.5 text-accent" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-accent" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm truncate", !n.lida && "font-semibold")}>{n.titulo}</p>
                      {!n.lida && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgoFn(n.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.lida && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markAsRead(n.id)} title="Marcar como lida">
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteNotif(n.id)} title="Excluir">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  );
};
