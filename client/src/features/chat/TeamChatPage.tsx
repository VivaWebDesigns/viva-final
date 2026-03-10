import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@features/auth/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hash, Send, Trash2 } from "lucide-react";

interface ChatMessage {
  id: string;
  channel: string;
  content: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[#0D9488]/10 text-[#0D9488]",
  developer: "bg-purple-100 text-purple-700",
  sales_rep: "bg-blue-100 text-blue-700",
};

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function TeamChatPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeChannel, setActiveChannel] = useState("general");
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/chat/channels"],
    staleTime: STALE.FAST,
  });

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chat/messages?channel=${activeChannel}`],
    refetchInterval: 4000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/messages", { channel: activeChannel, content });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/chat/messages?channel=${activeChannel}`] });
    },
    onError: (err: Error) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/chat/messages/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/chat/messages?channel=${activeChannel}`] });
    },
  });

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    sendMutation.mutate(text);
  }, [draft, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canDelete = (msg: ChatMessage) =>
    role === "admin" || role === "developer" || msg.senderId === (user as any)?.id;

  return (
    <div className="h-full flex flex-col" data-testid="page-team-chat">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Chat</h1>
          <p className="text-sm text-gray-500 mt-1">Internal team communication</p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-48 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-3 flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-1">Channels</p>
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left w-full ${
                activeChannel === ch.id
                  ? "bg-[#0D9488]/10 text-[#0D9488] font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              data-testid={`button-channel-${ch.id}`}
            >
              <Hash className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 min-h-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <Hash className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-800 text-sm">
              {channels.find(c => c.id === activeChannel)?.name || activeChannel}
            </span>
            <span className="text-xs text-gray-400 ml-1">
              {channels.find(c => c.id === activeChannel)?.description}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" data-testid="chat-messages-list">
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isLoading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <Hash className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium text-gray-400">No messages yet</p>
                <p className="text-xs text-gray-300 mt-1">Be the first to say something in #{activeChannel}</p>
              </div>
            )}

            {messages.map((msg, idx) => {
              const prevMsg = messages[idx - 1];
              const sameUser = prevMsg?.senderId === msg.senderId &&
                new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 group ${sameUser ? "mt-0.5" : "mt-3"}`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  {sameUser ? (
                    <div className="w-8 flex-shrink-0" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${ROLE_COLORS[msg.senderRole] || "bg-gray-100 text-gray-600"}`}>
                      {getInitials(msg.senderName)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {!sameUser && (
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-900">{msg.senderName}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {msg.senderRole.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed flex-1">{msg.content}</p>
                      {canDelete(msg) && (
                        <button
                          onClick={() => deleteMutation.mutate(msg.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
                          title="Delete message"
                          data-testid={`button-delete-message-${msg.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {sameUser && (
                      <span className="text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message #${activeChannel}`}
                rows={1}
                className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30 focus:border-[#0D9488] transition-colors"
                style={{ minHeight: "40px", maxHeight: "120px" }}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSend}
                disabled={!draft.trim() || sendMutation.isPending}
                size="icon"
                className="bg-[#0D9488] hover:bg-[#0F766E] text-white flex-shrink-0 h-10 w-10"
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Enter to send, Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </div>
  );
}
