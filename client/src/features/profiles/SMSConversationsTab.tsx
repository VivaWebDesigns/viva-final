import { useRef, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, MessageSquare, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SmsMessage } from "@shared/schema";

interface SMSConversationsTabProps {
  leadId: string;
  leadPhone: string | null | undefined;
  leadName?: string | null;
}

export default function SMSConversationsTab({ leadId, leadPhone, leadName }: SMSConversationsTabProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<{ data: SmsMessage[] }>({
    queryKey: ["/api/quo/conversations", leadId],
    queryFn: () => fetch(`/api/quo/conversations/${leadId}`).then((r) => {
      if (!r.ok) throw new Error("Failed to load conversations");
      return r.json();
    }),
    refetchInterval: 30_000,
    enabled: !!leadId,
  });

  const messages = data?.data ?? [];

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/quo/sms", {
        to: leadPhone,
        content,
        leadId,
      });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/quo/conversations", leadId] });
    },
    onError: (err: any) => {
      toast({
        title: "Error al enviar SMS",
        description: err?.message ?? "No se pudo enviar el mensaje. Intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || !leadPhone) return;
    sendMutation.mutate(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!leadPhone) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        data-testid="sms-no-phone"
      >
        <MessageSquare className="w-10 h-10 text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-600">No phone number on file</p>
        <p className="text-xs text-gray-400 mt-1">
          Add a phone number to this lead&apos;s contact to enable SMS conversations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="sms-conversations-tab">
      {/* Thread header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium text-gray-700">
            SMS con <span className="font-semibold">{leadPhone}</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-sms"
          title="Refresh messages"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Message thread */}
      <div
        className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0"
        style={{ maxHeight: "420px" }}
        data-testid="sms-thread"
      >
        {isLoading ? (
          <div className="space-y-3 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <Skeleton className={`h-12 rounded-xl ${i % 2 === 0 ? "w-48" : "w-56"}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="sms-empty">
            <MessageSquare className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-300 mt-0.5">Send the first message below</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isOutbound = msg.direction === "outbound";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 ${isOutbound ? "items-end" : "items-start"}`}
                  data-testid={`sms-message-${msg.id}`}
                >
                  <div
                    className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                      isOutbound
                        ? "bg-violet-600 text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[10px] text-gray-400 font-medium" data-testid={`sms-sender-${msg.id}`}>
                      {msg.senderName ?? (isOutbound ? "Team" : (leadName ?? leadPhone ?? "Lead"))}
                    </span>
                    <span className="text-[10px] text-gray-400" data-testid={`sms-timestamp-${msg.id}`}>
                      {format(new Date(msg.sentAt), "MMM d, h:mm a")}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-semibold tracking-wide px-1 py-0 rounded ${
                        isOutbound ? "text-violet-400" : "text-gray-400"
                      }`}
                      data-testid={`sms-direction-${msg.id}`}
                    >
                      {isOutbound ? "enviado" : "recibido"}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Compose box */}
      <div className="pt-3 border-t border-gray-100 space-y-2" data-testid="sms-compose-area">
        <Textarea
          placeholder="Escribe tu mensaje… (Ctrl+Enter para enviar)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          maxLength={1600}
          className="resize-none text-sm"
          disabled={sendMutation.isPending}
          data-testid="textarea-sms-compose"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{message.length}/1600</span>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white h-8 px-4 text-sm"
            data-testid="button-send-sms-thread"
          >
            <Send className="w-3.5 h-3.5" />
            {sendMutation.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
