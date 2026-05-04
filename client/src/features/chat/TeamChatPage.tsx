import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
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
  MessageCircle, Plus, Wifi, WifiOff, Circle, Paperclip, FileText,
  Image as ImageIcon, Loader2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import RichTextEditor, { type RichTextEditorHandle, sanitizeHtml } from "./RichTextEditor";
import { useAdminLang } from "@/i18n/LanguageContext";

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
  attachments?: ChatAttachment[];
}

interface DmMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  attachments?: ChatAttachment[];
}

interface ChatAttachment {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
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
const CHAT_ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);
const MAX_CHAT_ATTACHMENTS = 5;
const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function isImageAttachment(attachment: Pick<ChatAttachment, "mimeType">) {
  return attachment.mimeType.startsWith("image/");
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentDownloadUrl(attachment: Pick<ChatAttachment, "id">) {
  return `/api/attachments/${encodeURIComponent(attachment.id)}/download`;
}

function hasMessageContent(content: string | null | undefined) {
  const trimmed = (content ?? "").trim();
  return !!trimmed && trimmed !== "<p></p>";
}

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
  const { t } = useAdminLang();
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
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const isInDm = !!activeDmUserId;
  const currentUserId = (user as any)?.id as string | undefined;
  const canUseChannels = role === "admin";

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ["/api/chat/channels"],
    refetchInterval: 60000,
    staleTime: STALE.FAST,
    enabled: canUseChannels,
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
    enabled: !isInDm && canUseChannels,
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
    enabled: !!threadParentId && canUseChannels,
  });

  const { data: pinnedMessages = [] } = useQuery<PinnedMsg[]>({
    queryKey: ["/api/chat/pinned", activeChannel],
    queryFn: async () => {
      const res = await fetch(`/api/chat/pinned?channel=${activeChannel}`, { credentials: "include" });
      return res.json();
    },
    staleTime: STALE.MEDIUM,
    enabled: !isInDm && canUseChannels,
  });

  const { data: searchResults = [] } = useQuery<SearchResult[]>({
    queryKey: ["/api/chat/search", searchQuery, activeChannel],
    queryFn: async () => {
      const res = await fetch(`/api/chat/search?q=${encodeURIComponent(searchQuery)}&channel=${activeChannel}`, { credentials: "include" });
      return res.json();
    },
    enabled: searchQuery.length >= 2 && canUseChannels,
    staleTime: STALE.REALTIME,
  });

  // ── Socket: join/leave channels ─────────────────────────────────────────────

  const prevChannelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;
    if (!canUseChannels) return;
    if (!isInDm) {
      if (prevChannelRef.current && prevChannelRef.current !== activeChannel) {
        socket.emit("leave:channel", prevChannelRef.current);
      }
      socket.emit("join:channel", activeChannel);
      prevChannelRef.current = activeChannel;
    }
  }, [socket, isConnected, activeChannel, isInDm, canUseChannels]);

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
    } else if (canUseChannels) {
      socket.emit("typing:stop", { target: activeChannel, targetType: "channel" });
    }
  }, [socket, isInDm, activeDmUserId, activeChannel, canUseChannels]);

  const emitTypingStart = useCallback(() => {
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (isInDm && activeDmUserId) {
        socket.emit("typing:start", { target: activeDmUserId, targetType: "dm" });
      } else if (canUseChannels) {
        socket.emit("typing:start", { target: activeChannel, targetType: "channel" });
      }
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(emitTypingStop, 1500);
  }, [socket, isInDm, activeDmUserId, activeChannel, canUseChannels, emitTypingStop]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: async (channelId: string) => {
      await apiRequest("POST", "/api/chat/read", { channelId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat/channels"] }),
  });

  const clearComposer = useCallback(() => {
    editorRef.current?.clearEditor();
    setEditorIsEmpty(true);
    setMentionQuery(null);
    setPendingAttachments([]);
  }, []);

  const sendMutation = useMutation({
    mutationFn: async ({ content, attachmentIds }: { content: string; attachmentIds: string[] }) => {
      const res = await apiRequest("POST", "/api/chat/messages", { channel: activeChannel, content, attachmentIds });
      return res.json();
    },
    onSuccess: (newMsg: ChatMessage) => {
      qc.setQueryData<ChatMessage[]>([`/api/chat/messages?channel=${activeChannel}`], (prev) => {
        if (!prev) return [newMsg];
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      markReadMutation.mutate(activeChannel);
      clearComposer();
    },
    onError: (err: Error) => toast({ title: t.chat.sendError, description: err.message, variant: "destructive" }),
  });

  const sendDmMutation = useMutation({
    mutationFn: async ({ content, attachmentIds }: { content: string; attachmentIds: string[] }) => {
      const res = await apiRequest("POST", "/api/chat/dm/messages", { recipientId: activeDmUserId, content, attachmentIds });
      return res.json();
    },
    onSuccess: (newMsg: DmMessage) => {
      qc.setQueryData<DmMessage[]>(["/api/chat/dm/messages", activeDmUserId], (prev) => {
        if (!prev) return [newMsg];
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      qc.invalidateQueries({ queryKey: ["/api/chat/dm/conversations"] });
      clearComposer();
    },
    onError: (err: Error) => toast({ title: t.chat.sendError, description: err.message, variant: "destructive" }),
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

  const canDelete = (msg: ChatMessage) => msg.senderId === currentUserId || role === "admin";

  const handleEditorSend = useCallback((html: string) => {
    const trimmed = html.trim();
    const attachmentIds = pendingAttachments.map((attachment) => attachment.id);
    if ((!trimmed || trimmed === "<p></p>") && attachmentIds.length === 0) return;
    if (isUploadingAttachment) return;
    if (!isInDm && !canUseChannels) return;
    emitTypingStop();
    if (isInDm) sendDmMutation.mutate({ content: trimmed === "<p></p>" ? "" : trimmed, attachmentIds });
    else sendMutation.mutate({ content: trimmed === "<p></p>" ? "" : trimmed, attachmentIds });
  }, [pendingAttachments, isUploadingAttachment, isInDm, canUseChannels, emitTypingStop, sendDmMutation, sendMutation]);

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

  const uploadChatFiles = useCallback(async (files: File[]) => {
    const remainingSlots = MAX_CHAT_ATTACHMENTS - pendingAttachments.length;
    if (remainingSlots <= 0) {
      toast({ title: t.chat.attachmentLimit, variant: "destructive" });
      return;
    }

    const acceptedFiles = files.slice(0, remainingSlots).filter((file) => {
      if (!CHAT_ATTACHMENT_TYPES.has(file.type)) {
        toast({ title: t.chat.attachmentUnsupported, description: file.name, variant: "destructive" });
        return false;
      }
      if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
        toast({ title: t.chat.attachmentTooLarge, description: file.name, variant: "destructive" });
        return false;
      }
      return true;
    });
    if (acceptedFiles.length === 0) return;

    setIsUploadingAttachment(true);
    try {
      const uploaded: ChatAttachment[] = [];
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "chat");
        const res = await fetch("/api/attachments/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message || "Upload failed");
        }
        uploaded.push(await res.json());
      }
      setPendingAttachments((prev) => [...prev, ...uploaded].slice(0, MAX_CHAT_ATTACHMENTS));
    } catch (err: unknown) {
      toast({
        title: t.chat.attachmentUploadError,
        description: err instanceof Error ? err.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [pendingAttachments.length, t.chat.attachmentLimit, t.chat.attachmentTooLarge, t.chat.attachmentUnsupported, t.chat.attachmentUploadError, toast]);

  const handleAttachmentInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void uploadChatFiles(Array.from(event.target.files ?? []));
  };

  const removePendingAttachment = async (attachmentId: string) => {
    setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    try {
      await apiRequest("DELETE", `/api/attachments/${attachmentId}`);
    } catch {
      // The message send path only uses the local pending list, so a failed
      // cleanup should not block the user from continuing.
    }
  };

  const selectChannel = (id: string) => {
    if (!canUseChannels) return;
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
  const dmUserList = teamUsers.filter((u) => (
    (u as any).id !== currentUserId
    && (canUseChannels || u.role === "admin")
  ));
  const filteredMentions = mentionQuery !== null
    ? teamUsers.filter((u) => (u as any).id !== currentUserId && u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const currentTypingUsers = typingUsers.filter((t) => {
    if (isInDm && activeDmUserId) return t.target === currentUserId && t.targetType === "dm";
    return t.target === activeChannel && t.targetType === "channel";
  });

  const isOnline = (userId: string) => onlineUserIds.includes(userId);
  const chatInputDisabled = (!isInDm && !canUseChannels) || sendMutation.isPending || sendDmMutation.isPending;

  useEffect(() => {
    if (canUseChannels) return;

    const adminDmUsers = teamUsers.filter((u) => (u as any).id !== currentUserId && u.role === "admin");
    const activeDmIsAllowed = adminDmUsers.some((u) => u.id === activeDmUserId);

    if (!activeDmIsAllowed) {
      setActiveDmUserId(adminDmUsers[0]?.id ?? null);
      setThreadParentId(null);
      setShowSearch(false);
      setShowDmPicker(false);
    }
  }, [canUseChannels, teamUsers, currentUserId, activeDmUserId]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (chatInputDisabled || isUploadingAttachment) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-chat-composer='true']")) return;
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      void uploadChatFiles(files);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [chatInputDisabled, isUploadingAttachment, uploadChatFiles]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderAttachment(attachment: ChatAttachment, compact = false) {
    const downloadUrl = getAttachmentDownloadUrl(attachment);

    if (isImageAttachment(attachment)) {
      return (
        <a
          key={attachment.id}
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`group block overflow-hidden rounded-lg border border-gray-200 bg-gray-50 ${compact ? "max-w-64" : "max-w-sm"}`}
          title={attachment.originalName}
        >
          <img
            src={downloadUrl}
            alt={attachment.originalName}
            className="max-h-56 w-full object-cover transition-transform group-hover:scale-[1.01]"
            loading="lazy"
          />
        </a>
      );
    }

    return (
      <a
        key={attachment.id}
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-[#0D9488]/40 hover:bg-[#0D9488]/5 ${compact ? "max-w-64" : "max-w-sm"}`}
        title={attachment.originalName}
      >
        <FileText className="h-4 w-4 flex-shrink-0 text-[#0D9488]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{attachment.originalName}</span>
          <span className="block text-xs text-gray-400">{formatFileSize(attachment.sizeBytes)}</span>
        </span>
      </a>
    );
  }

  function renderAttachmentList(attachments: ChatAttachment[] | undefined, compact = false) {
    if (!attachments?.length) return null;
    return (
      <div className={`mt-2 flex flex-col gap-2 ${compact ? "items-start" : ""}`}>
        {attachments.map((attachment) => renderAttachment(attachment, compact))}
      </div>
    );
  }

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
            {hasMessageContent(msg.content) ? (
              <div
                className="text-sm text-gray-700 leading-relaxed flex-1 min-w-0 chat-message-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }}
              />
            ) : (
              <div className="flex-1" />
            )}
            <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-0.5 flex-shrink-0 mt-0.5">
              <button
                onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                className="text-gray-300 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                title={t.chat.react}
                data-testid={`button-react-${msg.id}`}
              >
                <SmilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setThreadParentId(msg.id)}
                className="text-gray-300 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                title={t.chat.replyInThread}
                data-testid={`button-thread-${msg.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              {role === "admin" && (
                <button
                  onClick={() => pinMutation.mutate({ id: msg.id, pinned: !msg.isPinned })}
                  className={`p-1 rounded hover:bg-gray-100 ${msg.isPinned ? "text-yellow-500" : "text-gray-300 hover:text-yellow-500"}`}
                  title={msg.isPinned ? t.chat.unpin : t.chat.pin}
                  data-testid={`button-pin-${msg.id}`}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete(msg) && (
                <button
                  onClick={() => deleteMutation.mutate(msg.id)}
                  className="text-gray-300 hover:text-red-400 p-1 rounded hover:bg-gray-100"
                  title={t.chat.delete}
                  data-testid={`button-delete-message-${msg.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {renderAttachmentList(msg.attachments)}

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
              {msg.replyCount === 1 ? t.chat.reply_one.replace("{{count}}", String(msg.replyCount)) : t.chat.reply_other.replace("{{count}}", String(msg.replyCount))}
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
          <h2 className="font-bold text-white text-sm uppercase tracking-wider">{t.chat.title}</h2>
          <div
            className={`flex items-center gap-1 text-[10px] ${isConnected ? "text-emerald-400" : "text-gray-500"}`}
            title={isConnected ? t.chat.connected : t.chat.reconnecting}
            data-testid="socket-status"
          >
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels */}
          {canUseChannels && (
            <div className="px-3 mb-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1">{t.chat.channels}</p>
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
                    <span className="truncate">{(t.chat.channelNames as Record<string, string>)[ch.id] || ch.name}</span>
                  </span>
                  {ch.unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center font-bold flex-shrink-0" data-testid={`unread-${ch.id}`}>
                      {ch.unreadCount > 99 ? "99+" : ch.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* DMs */}
          <div className="px-3">
            <div className="flex items-center justify-between px-2 mb-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t.chat.directMessages}</p>
              {canUseChannels && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDmPicker(!showDmPicker); }}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  title={t.chat.newDm}
                  data-testid="button-new-dm"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* DM user picker */}
            <AnimatePresence>
              {showDmPicker && canUseChannels && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                    <p className="text-[10px] text-gray-500 px-2 pt-2 pb-1">{t.chat.selectMember}</p>
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
              <p className="text-xs text-gray-600 px-2 py-1">{t.chat.noOtherMembers}</p>
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
                  <span className="font-semibold text-gray-900">{activeChannelData ? (t.chat.channelNames as Record<string, string>)[activeChannelData.id] || activeChannelData.name : ""}</span>
                  {activeChannelData?.description && (
                    <span className="text-xs text-gray-400 hidden sm:block">{activeChannelData.description}</span>
                  )}
                </>
              )}
            </div>
            {!isInDm && canUseChannels && (
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
                      <Pin className="w-3 h-3" /> {t.chat.pinnedMessages.replace("{{count}}", String(pinnedMessages.length))}
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
                      placeholder={t.chat.searchMessages}
                      className="pl-8 h-8 text-sm bg-white"
                      data-testid="input-chat-search"
                      autoFocus
                    />
                  </div>
                  {searchQuery.length >= 2 && (
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                      {searchResults.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 text-center">{t.chat.noResults}</p>
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
                    const senderName = isMine ? ((user as any)?.name ?? t.chat.you) : (activeDmUser?.name ?? "");
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
                          {hasMessageContent(msg.content) && (
                            <div
                              className={`rounded-2xl px-3 py-2 text-sm chat-message-content ${isMine ? "bg-[#0D9488] text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }}
                            />
                          )}
                          {renderAttachmentList(msg.attachments, true)}
                          <span className="text-[10px] text-gray-300 mt-0.5 px-1">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : !canUseChannels ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-300">
                <MessageCircle className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium text-gray-400">{t.chat.noMessages}</p>
              </div>
            ) : messages.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-300">
                <Hash className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium text-gray-400">{t.chat.noMessages}</p>
                <p className="text-xs text-gray-300 mt-1">#{activeChannel}</p>
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
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 relative" data-chat-composer="true">
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
            {pendingAttachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2" data-testid="pending-chat-attachments">
                {pendingAttachments.map((attachment) => (
                  <div key={attachment.id} className="group relative flex max-w-56 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                    {isImageAttachment(attachment) ? (
                      <ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#0D9488]" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#0D9488]" />
                    )}
                    <span className="min-w-0 flex-1 truncate" title={attachment.originalName}>
                      {attachment.originalName}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removePendingAttachment(attachment.id)}
                      className="rounded-full p-0.5 text-gray-400 hover:bg-white hover:text-red-500"
                      title={t.chat.removeAttachment}
                      data-testid={`button-remove-attachment-${attachment.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
                onChange={handleAttachmentInputChange}
                data-testid="input-chat-attachment"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={chatInputDisabled || isUploadingAttachment || pendingAttachments.length >= MAX_CHAT_ATTACHMENTS}
                className="h-10 w-10 flex-shrink-0 self-end"
                title={t.chat.attachFile}
                data-testid="button-attach-file"
              >
                {isUploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </Button>
              <RichTextEditor
                ref={editorRef}
                placeholder={isInDm ? t.chat.dmPlaceholder.replace("{{name}}", activeDmUser?.name ?? "DM") : t.chat.messagePlaceholder.replace("{{channel}}", activeChannel)}
                onSend={handleEditorSend}
                onTextChange={handleEditorTextChange}
                onBlur={emitTypingStop}
                disabled={chatInputDisabled}
                data-testid="input-chat-message"
              />
              <Button
                onClick={() => {
                  const html = editorRef.current?.getHTML() ?? "";
                  handleEditorSend(html);
                }}
                disabled={(editorIsEmpty && pendingAttachments.length === 0) || chatInputDisabled || isUploadingAttachment}
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
                  {hasMessageContent(threadParentMsg.content) && (
                    <div className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap line-clamp-3 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(threadParentMsg.content) }} />
                  )}
                  {renderAttachmentList(threadParentMsg.attachments, true)}
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {threadMessages.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">{t.chat.noReplies}</p>
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
                        {hasMessageContent(msg.content) && (
                          <div className="text-xs text-gray-700 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }} />
                        )}
                        {renderAttachmentList(msg.attachments, true)}
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
                    placeholder={t.chat.replyPlaceholder}
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
