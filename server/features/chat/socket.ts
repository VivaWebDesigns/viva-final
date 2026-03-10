import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { auth } from "../auth/auth";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "@shared/socket-types";

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

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
    const { userId, userName } = socket.data;

    socket.join(`user:${userId}`);

    broadcastPresence();

    socket.on("join:channel", (channelId: string) => {
      const allowedChannels = ["general", "ventas", "onboarding", "dev"];
      if (allowedChannels.includes(channelId)) {
        socket.join(`channel:${channelId}`);
      }
    });

    socket.on("leave:channel", (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on("typing:start", (data) => {
      const room = data.targetType === "channel"
        ? `channel:${data.target}`
        : `user:${data.target}`;
      socket.to(room).emit("chat:typing", {
        userId,
        userName,
        target: data.target,
        targetType: data.targetType,
        isTyping: true,
      });
    });

    socket.on("typing:stop", (data) => {
      const room = data.targetType === "channel"
        ? `channel:${data.target}`
        : `user:${data.target}`;
      socket.to(room).emit("chat:typing", {
        userId,
        userName,
        target: data.target,
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
