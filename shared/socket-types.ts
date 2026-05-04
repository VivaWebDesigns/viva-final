/**
 * Events emitted by the server to connected clients.
 *
 * - `chat:channel_message` — Broadcast when a new message is posted in a channel room.
 * - `chat:dm_message` — Sent privately to sender and recipient when a DM is created.
 * - `chat:typing` — Broadcast to the relevant room when a user starts or stops typing.
 * - `chat:presence` — Broadcast to all connected clients when the online user list changes.
 * - `chat:unread_update` — Sent to a specific user when their unread count changes for a channel or DM.
 */
export interface ServerToClientEvents {
  "chat:channel_message": (msg: ChannelMessagePayload) => void;
  "chat:dm_message": (msg: DmMessagePayload) => void;
  "chat:typing": (data: TypingPayload) => void;
  "chat:presence": (data: PresencePayload) => void;
  "chat:unread_update": (data: UnreadUpdatePayload) => void;
}

/**
 * Events emitted by the client to the server.
 *
 * - `join:channel` — Client requests to join a channel room. The `channelId` is
 *   normalized via `normalizeChannelId()` on the server; legacy IDs like `"ventas"`
 *   are transparently mapped to their canonical equivalents (e.g. `"sales"`).
 * - `leave:channel` — Client leaves a channel room.
 * - `typing:start` — Client signals that the user has started typing.
 * - `typing:stop` — Client signals that the user has stopped typing.
 */
export interface ClientToServerEvents {
  "join:channel": (channelId: string) => void;
  "leave:channel": (channelId: string) => void;
  "typing:start": (data: TypingTarget) => void;
  "typing:stop": (data: TypingTarget) => void;
}

/** Reserved for Socket.IO inter-server communication (unused). */
export interface InterServerEvents {}

/** Per-socket data attached during the authentication handshake. */
export interface SocketData {
  userId: string;
  userName: string;
  userRole: string;
}

/**
 * Payload for a channel message broadcast via `chat:channel_message`.
 * The `channel` field is always a canonical channel ID (e.g. `"sales"`, not `"ventas"`).
 */
export interface ChannelMessagePayload {
  id: string;
  /** Canonical channel identifier — one of the values in `CHANNEL_IDS`. */
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
  attachments: ChatAttachmentPayload[];
}

/** Payload for a direct message broadcast via `chat:dm_message`. */
export interface DmMessagePayload {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
  attachments: ChatAttachmentPayload[];
}

export interface ChatAttachmentPayload {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * Payload for typing indicator events (`chat:typing`).
 *
 * Lifecycle:
 * 1. Client emits `typing:start` with a `TypingTarget`.
 * 2. Server broadcasts `chat:typing` with `isTyping: true` to the room.
 * 3. Client emits `typing:stop` (or disconnects).
 * 4. Server broadcasts `chat:typing` with `isTyping: false` to the room.
 */
export interface TypingPayload {
  userId: string;
  userName: string;
  /** Channel ID or recipient user ID depending on `targetType`. */
  target: string;
  targetType: "channel" | "dm";
  isTyping: boolean;
}

/** Target descriptor sent by the client with `typing:start` / `typing:stop`. */
export interface TypingTarget {
  /** Channel ID (canonical) or recipient user ID. */
  target: string;
  targetType: "channel" | "dm";
}

/** Payload for `chat:presence` — the full list of currently online user IDs. */
export interface PresencePayload {
  onlineUserIds: string[];
}

/** Payload for `chat:unread_update` — notifies a user of new unread counts. */
export interface UnreadUpdatePayload {
  /** Present when the update is for a channel. */
  channelId?: string;
  /** Present when the update is for a DM conversation. */
  dmUserId?: string;
  unreadCount: number;
}
