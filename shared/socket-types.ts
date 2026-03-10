export interface ServerToClientEvents {
  "chat:channel_message": (msg: ChannelMessagePayload) => void;
  "chat:dm_message": (msg: DmMessagePayload) => void;
  "chat:typing": (data: TypingPayload) => void;
  "chat:presence": (data: PresencePayload) => void;
  "chat:unread_update": (data: UnreadUpdatePayload) => void;
}

export interface ClientToServerEvents {
  "join:channel": (channelId: string) => void;
  "leave:channel": (channelId: string) => void;
  "typing:start": (data: TypingTarget) => void;
  "typing:stop": (data: TypingTarget) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
  userName: string;
  userRole: string;
}

export interface ChannelMessagePayload {
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

export interface DmMessagePayload {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface TypingPayload {
  userId: string;
  userName: string;
  target: string;
  targetType: "channel" | "dm";
  isTyping: boolean;
}

export interface TypingTarget {
  target: string;
  targetType: "channel" | "dm";
}

export interface PresencePayload {
  onlineUserIds: string[];
}

export interface UnreadUpdatePayload {
  channelId?: string;
  dmUserId?: string;
  unreadCount: number;
}
