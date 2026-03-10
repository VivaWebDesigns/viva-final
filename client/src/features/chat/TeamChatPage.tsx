import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@features/auth/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Hash, Send, Trash2, MessageSquare, Search, Pin, SmilePlus, X,
  MessageCircle, Plus, Wifi, WifiOff, Circle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import RichTextEditor, { type RichTextEditorHandle, sanitizeHtml } from "./RichTextEditor";

interface ChatMessage {
  id: string;
  channel: string;
  content: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt: string;
  parentId: string | null;
  isPinned: boolean;
  reactions: { emoji: string; count: number; users: string[] }[];
  replyCount: number;
}

interface DmMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  unreadCount: number;
}

interface DmConversation {
  userId: string;
  userName: string;
  userRole: string;
  lastMessageAt: string;
  lastContent: string;
  unreadCount: number;
}

interface TeamUser {
  id: string;
  name: string;
  role: string;
}

interface SearchResult {
  id: string;
  channel: string;
  content: string;
  createdAt: string;
  senderName: string;
}

interface PinnedMsg {
  id: string;
  content: string;
  createdAt: string;
  senderName: string;
}

interface TypingState {
  userId: string;
  userName: string;
  target: string;
  targetType: "channel" | "dm";
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-[#0D9488]/10 text-[#0D9488]",
  developer: "bg-purple-100 text-purple-700",
  sales_rep: "bg-blue-100 text-blue-700",
};

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "✅", "💯"];

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function HighlightMentions({ text, users }: { text: string; users: TeamUser[] }) {
  const parts = text.split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        const mentioned = users.find((u) => `@${u.name}` === part || part === `@${u.name.split(" ")[0]}`);
        return mentioned ? (
          <span key={i} className="bg-[#0D9488]/10 text-[#0D9488] rounded px-0.5 font-medium">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

export default function TeamChatPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { socket, isConnected, onlineUserIds } = useSocket();

  const [activeChannel, setActiveChannel] = useState<string>("general");
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [editorIsEmpty, setEditorIsEmpty] = useState(true);
  const [threadDraft, setThreadDraft] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionQueryLen, setMentionQueryLen] = useState(0);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingState[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const isInDm = !!activeDmUserId;
  const currentUserId = (user as any)?.id as string | undefined;

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/chat/channels"],
    refetchInterval: 60000,
    staleTime: STALE.FAST,
  });

  const { data: teamUsers = [] } = useQuery<TeamUser[]>({
    queryKey: ["/api/chat/users"],
    staleTime: STALE.SLOW,
  });

  const { data: dmConversations = [] } = useQuery<DmConversation[]>({
    queryKey: ["/api/chat/dm/conversations"],
    refetchInterval: 30000,
    staleTime: STALE.FAST,
  });

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: [`/api/chat/messages?channel=${activeChannel}`],
    refetchInterval: 60000,
    enabled: !isInDm,
  });

  const { data: dmMessages = [] } = useQuery<DmMessage[]>({
    queryKey: ["/api/chat/dm/messages", activeDmUserId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/dm/messages?userId=${activeDmUserId}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!activeDmUserId,
  });

  const { data: threadMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", activeChannel, "thread", threadParentId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/messages?channel=${activeChannel}&parentId=${threadParentId}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!threadParentId,
  });

  const { data: pinnedMessages = [] } = useQuery<PinnedMsg[]>({
    queryKey: ["/api/chat/pinned", activeChannel],
    queryFn: async () => {
      const res = await fetch(`/api/chat/pinned?channel=${activeChannel}`, { credentials: "include" });
      return res.json();
    },
    staleTime: STALE.NORMAL,
    enabled: !isInDm,
  });

  const { data: searchResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/chat/search", searchQuery, activeChannel],
    queryFn: async () => {
      const res = await fetch(`/api/chat/search?q=${encodeURIComponent(searchQuery)}&channel=${activeChannel}`, { credentials: "include" });
      return res.json();
    },
    enabled: searchQuery.length >= 2,
    staleTime: 5000,
  });

  // ── Socket: join/leave channels ─────────────────────────────────────────────

  const prevChannelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;
    if (!isInDm) {
      if (prevChannelRef.current && prevChannelRef.current !== activeChannel) {
        socket.emit("leave:channel", prevChannelRef.current);
      }
      socket.emit("join:channel", activeChannel);
      prevChannelRef.current = activeChannel;
    }
  }, [socket, isConnected, activeChannel, isInDm]);

  // ── Socket: incoming messages ──────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onChannelMessage = (msg: ChatMessage) => {
      const key = `/api/chat/messages?channel=${msg.channel}`;
      qc.setQueryData<ChatMessage[]>([key], (prev) => {
        if (!prev) return [msg];
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (msg.senderId !== currentUserId) {
        qc.invalidateQueries({ queryKey: ["/api/chat/channels"] });
      }
    };

    const onDmMessage = (msg: DmMessage) => {
      qc.setQueryData<DmMessage[]>(["/api/chat/dm/messages", msg.senderId === currentUserId ? msg.recipientId : msg.senderId], (prev) => {
        if (!prev) return [msg];
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      qc.invalidateQueries({ queryKey: ["/api/chat/dm/conversations"] });
    };

    const onTyping = (data: TypingState & { isTyping: boolean }) => {
      if (data.userId === currentUserId) return;
      setTypingUsers((prev) => {
        const without = prev.filter((t) => !(t.userId === data.userId && t.target === data.target));
        if (data.isTyping) return [...without, { userId: data.userId, userName: data.userName, target: data.target, targetType: data.targetType }];
        return without;
      });
      if (data.isTyping) {
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((t) => !(t.userId === data.userId && t.target === data.target)));
        }, 4000);
      }
    };

    socket.on("chat:channel_message", onChannelMessage);
    socket.on("chat:dm_message", onDmMessage);
    socket.on("chat:typing", onTyping as any);

    return () => {
      socket.off("chat:channel_message", onChannelMessage);
      socket.off("chat:dm_message", onDmMessage);
      socket.off("chat:typing", onTyping as any);
    };
  }, [socket, currentUserId, qc]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, dmMessages]);

  // ── Typing indicator emit ──────────────────────────────────────────────────

  const emitTypingStop = useCallback(() => {
    if (!socket || !isTypingRef.current) return;
    isTypingRef.current = false;
    if (isInDm && activeDmUserId) {
      socket.emit("typing:stop", { target: activeDmUserId, targetType: "dm" });
    } else {
      socket.emit("typing:stop", { target: activeChannel, targetType: "channel" });
    }
  }, [socket, isInDm, activeDmUserId, activeChannel]);

  const emitTypingStart = useCallback(() => {
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (isInDm && activeDmUserId) {
        socket.emit("typing:start", { target: activeDmUserId, targetType: "dm" });
      } else {
        socket.emit("typing:start", { target: activeChannel, targetType: "channel" });
      }
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(emitTypingStop, 1500);
  }, [socket, isInDm, activeDmUserId, activeChannel, emitTypingStop]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: async (channelId: string) => {
      await apiRequest("POST", "/api/chat/read", { channelId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat/channels"] }),
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/messages", { channel: activeChannel, content });
      return res.json();
    },
    onSuccess: (newMsg: ChatMessage) => {
      qc.setQueryData<ChatMessage[]>([`/api/chat/messages?channel=${activeChannel}`], (prev) => {
        if (!prev) return [newMsg];
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      markReadMutation.mutate(activeChannel);
    },
    onError: (err: Error) => toast({ title: "Error al enviar", description: err.message, variant: "destructive" }),
  });

  const sendDmMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/dm/messages", { recipientId: activeDmUserId, content });
      return res.json();
    },
    onSuccess: (newMsg: DmMessage) => {
      qc.setQueryData<DmMessage[]>(["/api/chat/dm/messages", activeDmUserId], (prev) => {
        if (!prev) return [newMsg];
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      qc.invalidateQueries({ queryKey: ["/api/chat/dm/conversations"] });
    },
    onError: (err: Error) => toast({ title: "Error al enviar", description: err.message, variant: "destructive" }),
  });

  const sendThreadMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/messages", { channel: activeChannel, content, parentId: threadParentId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/chat/messages", activeChannel, "thread", threadParentId] });
      qc.invalidateQueries({ queryKey: [`/api/chat/messages?channel=${activeChannel}`] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/chat/messages/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/chat/messages?channel=${activeChannel}`] }),
  });

  const reactMutation = useMutation({
    mutationFn: async ({ id, emoji }: { id: string; emoji: string }) => {
      await apiRequest("POST", `/api/chat/messages/${id}/react`, { emoji });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/chat/messages?channel=${activeChannel}`] });
      setShowEmojiFor(null);
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await apiRequest("PUT", `/api/chat/messages/${id}/pin`, { pinned });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/chat/messages?channel=${activeChannel}`] });
      qc.invalidateQueries({ queryKey: ["/api/chat/pinned", activeChannel] });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const canDelete = (msg: ChatMessage) => msg.senderId === currentUserId || role === "admin" || role === "developer";

  const handleEditorSend = useCallback((html: string) => {
    const trimmed = html.trim();
    if (!trimmed || trimmed === "<p></p>") return;
    emitTypingStop();
    if (isInDm) sendDmMutation.mutate(trimmed);
    else sendMutation.mutate(trimmed);
    editorRef.current?.clearEditor();
    setEditorIsEmpty(true);
    setMentionQuery(null);
  }, [isInDm, emitTypingStop, sendDmMutation, sendMutation]);

  const handleKeyDownThread = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (threadDraft.trim()) { sendThreadMutation.mutate(threadDraft.trim()); setThreadDraft(""); }
    }
  };

  const handleEditorTextChange = (text: string) => {
    setEditorIsEmpty(!text.trim());
    if (text.trim()) emitTypingStart();
    else emitTypingStop();
    const match = text.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionQueryLen(match[0].length);
    } else {
      setMentionQuery(null);
      setMentionQueryLen(0);
    }
  };

  const insertMention = (u: TeamUser) => {
    editorRef.current?.insertMentionText(mentionQueryLen, u.name);
    setMentionQuery(null);
    setMentionQueryLen(0);
  };

  const selectChannel = (id: string) => {
    emitTypingStop();
    setActiveChannel(id);
    setActiveDmUserId(null);
    setThreadParentId(null);
    setShowSearch(false);
    setSearchQuery("");
    setShowDmPicker(false);
    markReadMutation.mutate(id);
  };

  const selectDm = (userId: string) => {
    emitTypingStop();
    setActiveDmUserId(userId);
    setThreadParentId(null);
    setShowSearch(false);
    setShowDmPicker(false);
    editorRef.current?.clearEditor();
    setEditorIsEmpty(true);
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const activeDmUser = teamUsers.find((u) => u.id === activeDmUserId);
  const activeChannelData = channels.find((c) => c.id === activeChannel);
  const threadParentMsg = messages.find((m) => m.id === threadParentId);
  const dmUserList = teamUsers.filter((u) => (u as any).id !== currentUserId);
  const filteredMentions = mentionQuery !== null
    ? teamUsers.filter((u) => (u as any).id !== currentUserId && u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const currentTypingUsers = typingUsers.filter((t) => {
    if (isInDm && activeDmUserId) return t.target === currentUserId && t.targetType === "dm";
    return t.target === activeChannel && t.targetType === "channel";
  });

  const isOnline = (userId: string) => onlineUserIds.includes(userId);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderChannelMsg(msg: ChatMessage, idx: number, arr: ChatMessage[]) {
    const prev = arr[idx - 1];
    const sameUser = prev?.senderId === msg.senderId
      && new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;

    return (
      <div
        key={msg.id}
        className={`flex gap-3 group relative ${sameUser ? "mt-0.5" : "mt-3"} ${msg.isPinned ? "bg-yellow-50/60 rounded-lg px-2 -mx-2" : ""}`}
        data-testid={`chat-message-${msg.id}`}
        onClick={(e) => e.stopPropagation()}
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
              {msg.isPinned && <Pin className="w-3 h-3 text-yellow-500" />}
            </div>
          )}
          <div className="flex items-start gap-2">
            <div
              className="text-sm text-gray-700 leading-relaxed flex-1 min-w-0 chat-message-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }}
            />
            <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5 flex-shrink-0 mt-0.5">
              <button
                onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                className="text-gray-300 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                title="Reaccionar"
                data-testid={`button-react-${msg.id}`}
              >
                <SmilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setThreadParentId(msg.id)}
                className="text-gray-300 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                title="Responder en hilo"
                data-testid={`button-thread-${msg.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              {(role === "admin" || role === "developer") && (
                <button
                  onClick={() => pinMutation.mutate({ id: msg.id, pinned: !msg.isPinned })}
                  className={`p-1 rounded hover:bg-gray-100 ${msg.isPinned ? "text-yellow-500" : "text-gray-300 hover:text-yellow-500"}`}
                  title={msg.isPinned ? "Desanclar" : "Anclar"}
                  data-testid={`button-pin-${msg.id}`}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete(msg) && (
                <button
                  onClick={() => deleteMutation.mutate(msg.id)}
                  className="text-gray-300 hover:text-red-400 p-1 rounded hover:bg-gray-100"
                  title="Eliminar"
                  data-testid={`button-delete-message-${msg.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {msg.reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => reactMutation.mutate({ id: msg.id, emoji: r.emoji })}
                  className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                    r.users.includes(currentUserId ?? "")
                      ? "bg-[#0D9488]/10 border-[#0D9488]/30 text-[#0D9488]"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                  data-testid={`reaction-${msg.id}-${r.emoji}`}
                >
                  {r.emoji} <span className="font-medium">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {msg.replyCount > 0 && (
            <button
              onClick={() => setThreadParentId(msg.id)}
              className="text-xs text-[#0D9488] hover:underline mt-1 flex items-center gap-1"
              data-testid={`button-view-thread-${msg.id}`}
            >
              <MessageSquare className="w-3 h-3" />
              {msg.replyCount} {msg.replyCount === 1 ? "respuesta" : "respuestas"}
            </button>
          )}

          {sameUser && (
            <span className="text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
              {formatTime(msg.createdAt)}
            </span>
          )}
        </div>

        {showEmojiFor === msg.id && (
          <div
            className="absolute top-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex gap-1"
            data-testid="emoji-picker"
            onClick={(e) => e.stopPropagation()}
          >
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => reactMutation.mutate({ id: msg.id, emoji: e })}
                className="text-lg hover:scale-125 transition-transform leading-none"
                data-testid={`emoji-${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-[calc(100vh-80px)] -mx-4 -mt-4 overflow-hidden"
      data-testid="page-team-chat"
      onClick={() => { setShowEmojiFor(null); setShowDmPicker(false); }}
    >
      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div className="w-60 flex-shrink-0 bg-gray-900 text-gray-300 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="font-bold text-white text-sm uppercase tracking-wider">Chat del Equipo</h2>
          <div
            className={`flex items-center gap-1 text-[10px] ${isConnected ? "text-emerald-400" : "text-gray-500"}`}
            title={isConnected ? "Conectado en tiempo real" : "Reconectando..."}
            data-testid="socket-status"
          >
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels */}
          <div className="px-3 mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1">Canales</p>
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => selectChannel(ch.id)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                  !isInDm && activeChannel === ch.id
                    ? "bg-[#0D9488] text-white"
                    : "hover:bg-gray-800 text-gray-300"
                }`}
                data-testid={`button-channel-${ch.id}`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{ch.name}</span>
                </span>
                {ch.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center font-bold flex-shrink-0" data-testid={`unread-${ch.id}`}>
                    {ch.unreadCount > 99 ? "99+" : ch.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* DMs */}
          <div className="px-3">
            <div className="flex items-center justify-between px-2 mb-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Mensajes Directos</p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDmPicker(!showDmPicker); }}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Nuevo mensaje directo"
                data-testid="button-new-dm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* DM user picker */}
            <AnimatePresence>
              {showDmPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                    <p className="text-[10px] text-gray-500 px-2 pt-2 pb-1">Selecciona un miembro</p>
                    {dmUserList.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => selectDm(u.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700 transition-colors text-left"
                        data-testid={`dm-picker-user-${u.id}`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[10px] font-bold text-gray-200">
                            {getInitials(u.name)}
                          </div>
                          {isOnline(u.id) && (
                            <Circle className="w-2 h-2 text-emerald-400 fill-emerald-400 absolute -bottom-0.5 -right-0.5" />
                          )}
                        </div>
                        <span className="text-xs text-gray-300 truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {dmUserList.length === 0 ? (
              <p className="text-xs text-gray-600 px-2 py-1">Sin otros miembros</p>
            ) : (
              dmUserList.map((u) => {
                const conv = dmConversations.find((c) => c.userId === u.id);
                const isActive = activeDmUserId === u.id;
                const online = isOnline(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => selectDm(u.id)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                      isActive ? "bg-[#0D9488] text-white" : "hover:bg-gray-800 text-gray-300"
                    }`}
                    data-testid={`button-dm-${u.id}`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <div className="relative flex-shrink-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? "bg-white text-[#0D9488]" : "bg-gray-600 text-gray-200"}`}>
                          {getInitials(u.name)}
                        </div>
                        {online && (
                          <Circle className="w-2 h-2 text-emerald-400 fill-emerald-400 absolute -bottom-0.5 -right-0.5" />
                        )}
                      </div>
                      <span className="truncate text-xs">{u.name}</span>
                    </span>
                    {conv && conv.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center font-bold flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex bg-white overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
            <div className="flex items-center gap-2">
              {isInDm ? (
                <>
                  <MessageCircle className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-900">{activeDmUser?.name ?? "DM"}</span>
                  {activeDmUser && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {activeDmUser.role.replace("_", " ")}
                    </Badge>
                  )}
                  {activeDmUserId && isOnline(activeDmUserId) && (
                    <span className="flex items-center gap-1 text-xs text-emerald-500" data-testid="dm-online-status">
                      <Circle className="w-2 h-2 fill-emerald-400" /> en línea
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-900">{activeChannelData?.name}</span>
                  {activeChannelData?.description && (
                    <span className="text-xs text-gray-400 hidden sm:block">{activeChannelData.description}</span>
                  )}
                </>
              )}
            </div>
            {!isInDm && (
              <div className="flex items-center gap-1">
                {pinnedMessages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowPinned(!showPinned)}
                    title={`${pinnedMessages.length} anclado(s)`}
                    data-testid="button-show-pinned"
                  >
                    <Pin className={`w-4 h-4 ${showPinned ? "text-yellow-500" : "text-gray-400"}`} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }}
                  data-testid="button-toggle-search"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Pinned messages banner */}
          <AnimatePresence>
            {showPinned && pinnedMessages.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-yellow-200 bg-yellow-50 overflow-hidden flex-shrink-0"
              >
                <div className="px-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-yellow-700 flex items-center gap-1">
                      <Pin className="w-3 h-3" /> Mensajes Anclados ({pinnedMessages.length})
                    </span>
                    <button onClick={() => setShowPinned(false)} className="text-yellow-600 hover:text-yellow-800">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {pinnedMessages.slice(0, 3).map((p) => (
                    <div key={p.id} className="text-xs text-gray-700 py-0.5 truncate">
                      <span className="font-medium text-gray-500">{p.senderName}:</span> {p.content}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search bar */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-b border-gray-100 overflow-hidden flex-shrink-0"
              >
                <div className="px-4 py-2 bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar mensajes en este canal..."
                      className="pl-8 h-8 text-sm bg-white"
                      data-testid="input-chat-search"
                      autoFocus
                    />
                  </div>
                  {searchQuery.length >= 2 && (
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                      {searchResults.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 text-center">Sin resultados</p>
                      ) : (
                        searchResults.map((r) => (
                          <div key={r.id} className="text-xs bg-white border border-gray-100 rounded p-2" data-testid={`search-result-${r.id}`}>
                            <span className="font-medium text-gray-700">{r.senderName}</span>
                            <span className="text-gray-400 mx-1">·</span>
                            <span className="text-gray-400">{formatTime(r.createdAt)}</span>
                            <p className="text-gray-600 mt-0.5 truncate">{r.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-4 py-3" data-testid="chat-messages-list">
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {isInDm ? (
              dmMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-300">
                  <MessageCircle className="w-10 h-10 mb-3" />
                  <p className="text-sm font-medium text-gray-400">Inicia la conversación</p>
                  <p className="text-xs text-gray-300 mt-1">Envía el primer mensaje a {activeDmUser?.name}</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {dmMessages.map((msg, idx) => {
                    const isMine = msg.senderId === currentUserId;
                    const prev = dmMessages[idx - 1];
                    const sameUser = prev?.senderId === msg.senderId
                      && new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
                    const senderName = isMine ? ((user as any)?.name ?? "Tú") : (activeDmUser?.name ?? "");
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"} ${sameUser ? "mt-0.5" : "mt-3"}`}
                        data-testid={`dm-message-${msg.id}`}
                      >
                        {!isMine && !sameUser && (
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 self-end">
                            {getInitials(senderName)}
                          </div>
                        )}
                        {!isMine && sameUser && <div className="w-7 mr-2 flex-shrink-0" />}
                        <div className={`max-w-[70%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                          {!sameUser && !isMine && (
                            <span className="text-xs text-gray-500 mb-0.5 ml-1">{senderName}</span>
                          )}
                          <div className={`rounded-2xl px-3 py-2 text-sm ${isMine ? "bg-[#0D9488] text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                            {msg.content}
                          </div>
                          <span className="text-[10px] text-gray-300 mt-0.5 px-1">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : messages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-300">
                <Hash className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium text-gray-400">Sin mensajes aún</p>
                <p className="text-xs text-gray-300 mt-1">Sé el primero en escribir en #{activeChannel}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {messages.map((msg, idx, arr) => renderChannelMsg(msg, idx, arr))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing indicator */}
          {currentTypingUsers.length > 0 && (
            <div className="px-4 pb-1 flex-shrink-0" data-testid="typing-indicator">
              <p className="text-xs text-gray-400 italic">
                {currentTypingUsers.map((t) => t.userName).join(", ")} {currentTypingUsers.length === 1 ? "está" : "están"} escribiendo...
              </p>
            </div>
          )}

          {/* Input area */}
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 relative">
            {mentionQuery !== null && filteredMentions.length > 0 && (
              <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden max-h-40 overflow-y-auto">
                {filteredMentions.map((u) => (
                  <button
                    key={u.id}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm text-left"
                    data-testid={`mention-${u.id}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {getInitials(u.name)}
                    </div>
                    <span className="font-medium text-gray-800">{u.name}</span>
                    <span className="text-xs text-gray-400">{u.role.replace("_", " ")}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <RichTextEditor
                ref={editorRef}
                placeholder={isInDm ? `Mensaje a ${activeDmUser?.name ?? "DM"}` : `Mensaje en #${activeChannel} — @ para mencionar`}
                onSend={handleEditorSend}
                onTextChange={handleEditorTextChange}
                onBlur={emitTypingStop}
                disabled={sendMutation.isPending || sendDmMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={() => {
                  const html = editorRef.current?.getHTML() ?? "";
                  handleEditorSend(html);
                }}
                disabled={editorIsEmpty || sendMutation.isPending || sendDmMutation.isPending}
                size="icon"
                className="bg-[#0D9488] hover:bg-[#0F766E] text-white flex-shrink-0 h-10 w-10 self-end"
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Thread panel ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {threadParentId && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-gray-100 flex flex-col bg-gray-50 overflow-hidden flex-shrink-0"
            >
              <div className="px-3 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-sm text-gray-900">Hilo</span>
                </div>
                <button
                  onClick={() => setThreadParentId(null)}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid="button-close-thread"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {threadParentMsg && (
                <div className="px-3 py-2 bg-white border-b border-gray-100 flex-shrink-0">
                  <p className="text-xs font-medium text-gray-500">{threadParentMsg.senderName}</p>
                  <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap line-clamp-3">{threadParentMsg.content}</p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {threadMessages.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Sin respuestas aún</p>
                ) : (
                  threadMessages.map((msg) => (
                    <div key={msg.id} className="flex gap-2" data-testid={`thread-message-${msg.id}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${ROLE_COLORS[msg.senderRole] || "bg-gray-100 text-gray-600"}`}>
                        {getInitials(msg.senderName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-gray-900">{msg.senderName}</span>
                          <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                        </div>
                        <div className="text-xs text-gray-700 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
                <div className="flex items-end gap-1.5">
                  <textarea
                    value={threadDraft}
                    onChange={(e) => setThreadDraft(e.target.value)}
                    onKeyDown={handleKeyDownThread}
                    placeholder="Responder en hilo..."
                    rows={1}
                    className="flex-1 resize-none bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0D9488]/30 focus:border-[#0D9488]"
                    style={{ minHeight: "34px", maxHeight: "80px" }}
                    data-testid="input-thread-message"
                  />
                  <Button
                    onClick={() => { if (threadDraft.trim()) { sendThreadMutation.mutate(threadDraft.trim()); setThreadDraft(""); } }}
                    disabled={!threadDraft.trim() || sendThreadMutation.isPending}
                    size="icon"
                    className="bg-[#0D9488] hover:bg-[#0F766E] text-white h-8 w-8 flex-shrink-0"
                    data-testid="button-send-thread"
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
