import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { act, screen, waitFor }                                                 from "@testing-library/react";
import userEvent                                                               from "@testing-library/user-event";
import { http, HttpResponse }                            from "msw";
import { renderWithProviders }                           from "../helpers/renderWithProviders";
import { server }                                       from "../helpers/server";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    user: { id: "u1", email: "admin@test.com", name: "Admin", role: "admin" },
  },
}));

vi.mock("@features/auth/authClient", () => ({
  useSession: () => ({
    data: { user: mockAuthState.user, session: {} },
    isPending: false,
    error: null,
  }),
  signIn:  vi.fn(),
  signOut: vi.fn(),
}));

const { socketHandlers, mockSocket } = vi.hoisted(() => {
  const socketHandlers = new Map<string, Set<(data: any) => void>>();
  const mockSocket = {
    on: vi.fn((event: string, handler: (data: any) => void) => {
      const handlers = socketHandlers.get(event) ?? new Set();
      handlers.add(handler);
      socketHandlers.set(event, handlers);
    }),
    off: vi.fn((event: string, handler: (data: any) => void) => {
      socketHandlers.get(event)?.delete(handler);
    }),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  };

  return { socketHandlers, mockSocket };
});

vi.mock("socket.io-client", () => ({
  io: () => mockSocket,
}));

import TeamChatPage from "@features/chat/TeamChatPage";

describe("TeamChatPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  beforeEach(() => {
    mockAuthState.user = { id: "u1", email: "admin@test.com", name: "Admin", role: "admin" };
  });
  afterEach(() => {
    server.resetHandlers();
    socketHandlers.clear();
  });
  afterAll(()  => server.close());

  it("renders without crashing", async () => {
    renderWithProviders(<TeamChatPage />, { route: "/admin/chat" });
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("renders channel sidebar buttons", async () => {
    renderWithProviders(<TeamChatPage />, { route: "/admin/chat" });
    expect(await screen.findByTestId("button-channel-general")).toBeInTheDocument();
  });

  it("uses the authenticated download route for chat attachments", async () => {
    server.use(
      http.get("/api/chat/messages", () => HttpResponse.json([
        {
          id: "msg-1",
          channel: "general",
          content: "",
          senderId: "u1",
          senderName: "Admin",
          senderRole: "admin",
          createdAt: new Date().toISOString(),
          parentId: null,
          isPinned: false,
          reactions: [],
          replyCount: 0,
          attachments: [
            {
              id: "att-1",
              url: "/broken-stored-url",
              originalName: "screenshot.png",
              mimeType: "image/png",
              sizeBytes: 1024,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ])),
    );

    renderWithProviders(<TeamChatPage />, { route: "/admin/chat" });

    const image = await screen.findByAltText("screenshot.png");
    expect(image).toHaveAttribute("src", "/api/attachments/att-1/download");
    expect(image.closest("a")).toHaveAttribute("href", "/api/attachments/att-1/download");
  });

  it("shows an online presence dot beside online DM users", async () => {
    server.use(
      http.get("/api/chat/users", () => HttpResponse.json([
        { id: "u2", name: "Ivonne", role: "sales_rep" },
      ])),
    );

    renderWithProviders(<TeamChatPage />, { route: "/admin/chat" });
    expect(await screen.findByTestId("button-dm-u2")).toBeInTheDocument();

    act(() => {
      socketHandlers.get("chat:presence")?.forEach((handler) => handler({ onlineUserIds: ["u2"] }));
    });

    expect(await screen.findByTestId("presence-dot-u2")).toBeInTheDocument();
  });

  it("lets a sales rep reply when Matt comes from an existing DM conversation", async () => {
    mockAuthState.user = { id: "ivonne", email: "ivonne@test.com", name: "Ivonne", role: "sales_rep" };
    server.use(
      http.get("/api/chat/users", () => HttpResponse.json([])),
      http.get("/api/chat/dm/conversations", () => HttpResponse.json([
        {
          userId: "matt",
          userName: "Matt Carney",
          userRole: "admin",
          lastMessageAt: new Date().toISOString(),
          lastContent: "Can you reply?",
          unreadCount: 0,
        },
      ])),
    );

    renderWithProviders(<TeamChatPage />, { route: "/admin/chat" });

    expect(await screen.findByTestId("button-dm-matt")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("button-attach-file")).not.toBeDisabled());
  });

  it("enables typing after a sales rep DM is auto-selected", async () => {
    const user = userEvent.setup();
    mockAuthState.user = { id: "ivonne", email: "ivonne@test.com", name: "Ivonne", role: "sales_rep" };
    server.use(
      http.get("/api/chat/users", () => HttpResponse.json([
        { id: "matt", name: "Matt Carney", role: "admin" },
      ])),
    );

    renderWithProviders(<TeamChatPage />, { route: "/admin/chat" });

    const editor = await screen.findByTestId("input-chat-message");
    await user.click(editor);
    await user.keyboard("Reply from Ivonne");

    expect(editor).toHaveTextContent("Reply from Ivonne");
  });
});
