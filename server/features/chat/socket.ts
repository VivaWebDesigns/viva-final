import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { auth } from "../auth/auth";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "@shared/socket-types";
import { normalizeChannelId } from "@shared/channels";
import { canUserDirectMessageUser } from "./access";

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const CHAT_ADMIN_ROLE = "admin";
const isChatAdmin = (role?: string | null) => role === CHAT_ADMIN_ROLE;

export function initSocket(httpServer: HttpServer) {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: true,
        credentials: true,
      },
      path: "/socket.io/",
    }
  );

  io.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie ?? "";
      const fakeHeaders = new Headers({ cookie: rawCookie });
      const session = await auth.api.getSession({ headers: fakeHeaders });

      if (!session?.user) {
        return next(new Error("Unauthorized"));
      }

      socket.data.userId = session.user.id;
      socket.data.userName = session.user.name;
      socket.data.userRole = (session.user as any).role ?? "sales_rep";
      next();
    } catch (err) {
      next(new Error("Auth error"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, userName, userRole } = socket.data;

    socket.join(`user:${userId}`);

    broadcastPresence();

    socket.on("join:channel", (channelId: string) => {
      if (!isChatAdmin(userRole)) return;
      const normalized = normalizeChannelId(channelId);
      if (normalized) {
        socket.join(`channel:${normalized}`);
      }
    });

    socket.on("leave:channel", (channelId: string) => {
      if (!isChatAdmin(userRole)) return;
      const normalized = normalizeChannelId(channelId);
      if (normalized) {
        socket.leave(`channel:${normalized}`);
      }
    });

    socket.on("typing:start", async (data) => {
      if (data.targetType === "channel" && !isChatAdmin(userRole)) return;
      if (data.targetType === "dm" && !(await canUserDirectMessageUser(userId, data.target))) return;

      const target = data.targetType === "channel"
        ? normalizeChannelId(data.target)
        : data.target;
      if (!target) return;
      const room = data.targetType === "channel" ? `channel:${target}` : `user:${target}`;
      socket.to(room).emit("chat:typing", {
        userId,
        userName,
        target,
        targetType: data.targetType,
        isTyping: true,
      });
    });

    socket.on("typing:stop", async (data) => {
      if (data.targetType === "channel" && !isChatAdmin(userRole)) return;
      if (data.targetType === "dm" && !(await canUserDirectMessageUser(userId, data.target))) return;

      const target = data.targetType === "channel"
        ? normalizeChannelId(data.target)
        : data.target;
      if (!target) return;
      const room = data.targetType === "channel" ? `channel:${target}` : `user:${target}`;
      socket.to(room).emit("chat:typing", {
        userId,
        userName,
        target,
        targetType: data.targetType,
        isTyping: false,
      });
    });

    socket.on("disconnect", () => {
      broadcastPresence();
    });
  });

  async function broadcastPresence() {
    const sockets = await io.fetchSockets();
    const onlineUserIds = [...new Set(sockets.map((s) => s.data.userId).filter(Boolean))];
    io.emit("chat:presence", { onlineUserIds });
  }

  return io;
}

export function getIO() {
  return io;
}
