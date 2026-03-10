import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@shared/socket-types";

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: ChatSocket | null = null;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const socketRef = useRef<ChatSocket | null>(null);

  useEffect(() => {
    if (!globalSocket) {
      globalSocket = io(window.location.origin, {
        path: "/socket.io/",
        withCredentials: true,
        transports: ["websocket", "polling"],
      });
    }

    const socket = globalSocket;
    socketRef.current = socket;

    if (socket.connected) {
      setIsConnected(true);
    }

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onPresence = (data: { onlineUserIds: string[] }) => {
      setOnlineUserIds(data.onlineUserIds);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat:presence", onPresence);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chat:presence", onPresence);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    onlineUserIds,
  };
}
