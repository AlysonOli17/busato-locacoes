import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

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

export const NotificationsDropdown = () => {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotificacoes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotificacoes(data as Notificacao[]);
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
      }, () => {
        fetchNotificacoes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notificacoes.filter(n => !n.lida).length;

  const markAsRead = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notificacoes").update({ lida: true }).eq("user_id", user.id).eq("lida", false);
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const deleteNotif = async (id: string) => {
    await supabase.from("notificacoes").delete().eq("id", id);
    setNotificacoes(prev => prev.filter(n => n.id !== id));
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notificacoes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Sem notificações</div>
          ) : (
            notificacoes.map(n => (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors",
                  !n.lida && "bg-accent/10"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm truncate", !n.lida && "font-semibold")}>{n.titulo}</p>
                    {!n.lida && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensagem}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {!n.lida && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markAsRead(n.id)}>
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteNotif(n.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
