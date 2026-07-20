"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Send,
  Trash2,
  Edit2,
  Archive,
  Paperclip,
  X,
  Loader2,
  Image as ImageIcon,
  FileText,
  StopCircle,
} from "lucide-react";

type Conversation = {
  id: string;
  title: string;
  isArchived: boolean;
  updatedAt: string;
  _count?: { messages: number };
};

type Message = {
  id: string;
  role: string;
  content: string;
  status: string;
  selectedModel?: string | null;
  routedModel?: string | null;
  routedProvider?: string | null;
  attachments?: Attachment[];
  createdAt: string;
};

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  kind: string;
  bytes: number;
};

type ModelInfo = {
  id: string;
  vision: boolean;
  toolCalling: boolean;
  reasoning: boolean;
  providerFamily: string;
  contextLength?: number;
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d4a96a",
  google: "#4285f4",
  xai: "#ff6b35",
  deepseek: "#6366f1",
  meta: "#0668e1",
  mistral: "#ff7000",
  other: "#888",
};

export default function ChatPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    Array<{
      id: string;
      filename: string;
      mimeType: string;
      bytes: number;
      kind: string;
      storageKey: string;
      extractedText: string | null;
    }>
  >([]);
  const [uploading, setUploading] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await fetch("/api/chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // Load models
  useEffect(() => {
    fetch("/api/chat/models")
      .then((r) => r.json())
      .then((data) => {
        const modelList = data.models || [];
        setModels(modelList);
        // Default to a good model if available
        const defaultModel =
          modelList.find((m: ModelInfo) => m.id.includes("claude-sonnet")) ||
          modelList.find((m: ModelInfo) => m.id.includes("gpt-5")) ||
          modelList.find((m: ModelInfo) => m.id.includes("gemini")) ||
          modelList[0];
        if (defaultModel) setSelectedModel(defaultModel.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Load messages when conversation changes
  const loadConversation = useCallback(async (id: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConversation(data.conversation);
        setMessages(data.conversation.messages || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Create new conversation
  const handleNewConversation = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConversation(data.conversation);
        setMessages([]);
        setError("");
      }
    } catch {
      setError("Failed to create conversation");
    }
  }, []);

  // Delete conversation
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      if (!confirm("Delete this conversation? This cannot be undone.")) return;
      try {
        const res = await fetch(`/api/chat/conversations/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (activeConversation?.id === id) {
            setActiveConversation(null);
            setMessages([]);
          }
        }
      } catch {
        setError("Failed to delete conversation");
      }
    },
    [activeConversation],
  );

  // Rename conversation
  const handleRenameConversation = useCallback(
    async (conv: Conversation) => {
      const title = prompt("Rename conversation:", conv.title);
      if (!title || title === conv.title) return;
      try {
        const res = await fetch(`/api/chat/conversations/${conv.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          setConversations((prev) =>
            prev.map((c) => (c.id === conv.id ? { ...c, title } : c)),
          );
          if (activeConversation?.id === conv.id) {
            setActiveConversation({ ...activeConversation, title });
          }
        }
      } catch {
        // ignore
      }
    },
    [activeConversation],
  );

  // Handle file upload
  const handleFileSelect = useCallback(
    async (files: FileList) => {
      if (!activeConversation || files.length === 0) return;
      setUploading(true);
      setError("");
      try {
        const formData = new FormData();
        formData.append("conversationId", activeConversation.id);
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }

        const res = await fetch("/api/chat/attachments", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Upload failed");
          return;
        }

        if (data.attachments) {
          setPendingAttachments((prev) => [...prev, ...data.attachments]);
        }
        if (data.errors?.length) {
          setError(
            data.errors
              .map(
                (e: { filename: string; reason: string }) =>
                  `${e.filename}: ${e.reason}`,
              )
              .join("; "),
          );
        }
      } catch {
        setError("Failed to upload files");
      } finally {
        setUploading(false);
      }
    },
    [activeConversation],
  );

  // Remove pending attachment
  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Send message
  const handleSend = useCallback(async () => {
    if (
      !activeConversation ||
      (!input.trim() && pendingAttachments.length === 0) ||
      streaming
    )
      return;
    if (!selectedModel) {
      setError("Please select a model");
      return;
    }

    const messageText = input.trim();
    const attachments = [...pendingAttachments];
    setInput("");
    setPendingAttachments([]);
    setStreaming(true);
    setStreamingText("");
    setError("");

    // Add user message to UI immediately
    const tempUserMsg: Message = {
      id: "temp-user-" + Date.now(),
      role: "user",
      content: messageText,
      status: "complete",
      attachments: attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        kind: a.kind,
        bytes: a.bytes,
      })),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          content: messageText,
          model: selectedModel,
          attachments,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantId = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "start") {
              assistantId = event.messageId;
            } else if (event.type === "text-delta") {
              setStreamingText((prev) => prev + event.text);
            } else if (event.type === "finish") {
              const finalContent = event.content || streamingText;
              setMessages((prev) => [
                ...prev,
                {
                  id: event.messageId || assistantId,
                  role: "assistant",
                  content: finalContent,
                  status: event.interrupted ? "interrupted" : "complete",
                  selectedModel,
                  routedModel: event.routedModel,
                  createdAt: new Date().toISOString(),
                },
              ]);
              setStreamingText("");
            } else if (event.type === "error") {
              setError(event.message || "Stream error");
              setStreamingText("");
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Stopped by user — keep partial text
        if (streamingText) {
          setMessages((prev) => [
            ...prev,
            {
              id: "temp-assistant-" + Date.now(),
              role: "assistant",
              content: streamingText,
              status: "interrupted",
              selectedModel,
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to send message");
      }
      setStreamingText("");
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
      // Reload conversations to update order
      void loadConversations();
    }
  }, [
    activeConversation,
    input,
    pendingAttachments,
    streaming,
    selectedModel,
    streamingText,
    loadConversations,
  ]);

  // Stop streaming
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const selectedModelInfo = models.find((m) => m.id === selectedModel);
  const canAttachImages = selectedModelInfo?.vision ?? false;

  return (
    <div
      className="dash-content"
      style={{
        display: "flex",
        gap: "0",
        height: "calc(100vh - 120px)",
        overflow: "hidden",
      }}
    >
      {/* Sidebar — Conversation List */}
      <div
        style={{
          width: "280px",
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}
        >
          <button
            onClick={handleNewConversation}
            className="btn-primary w-full flex-center gap-8 text-12"
            style={{ padding: "10px" }}
          >
            <Plus size={14} /> New Conversation
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {loadingConversations ? (
            <div className="flex-center" style={{ padding: "24px" }}>
              <Loader2
                size={20}
                className="animate-spin"
                style={{ color: "var(--muted)" }}
              />
            </div>
          ) : conversations.length === 0 ? (
            <p
              className="text-12 text-muted text-center"
              style={{ padding: "24px 12px" }}
            >
              No conversations yet. Start a new one!
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => void loadConversation(conv.id)}
                className={`dash-nav-item ${activeConversation?.id === conv.id ? "active" : ""}`}
                style={{
                  cursor: "pointer",
                  marginBottom: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {conv.title}
                </span>
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRenameConversation(conv);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--muted)",
                      padding: "2px",
                    }}
                    title="Rename"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteConversation(conv.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--muted)",
                      padding: "2px",
                    }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header — Model Selector */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="input-field"
            style={{ width: "auto", minWidth: "200px", fontSize: "13px" }}
          >
            {models.length === 0 && <option value="">Loading models...</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} ({m.providerFamily})
              </option>
            ))}
          </select>
          {selectedModelInfo && (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {selectedModelInfo.vision && (
                <span className="badge" style={{ fontSize: "9px" }}>
                  Vision
                </span>
              )}
              {selectedModelInfo.reasoning && (
                <span className="badge" style={{ fontSize: "9px" }}>
                  Reasoning
                </span>
              )}
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background:
                    PROVIDER_COLORS[selectedModelInfo.providerFamily] || "#888",
                }}
              />
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loadingMessages ? (
            <div className="flex-center" style={{ height: "100%" }}>
              <Loader2
                size={24}
                className="animate-spin"
                style={{ color: "var(--muted)" }}
              />
            </div>
          ) : !activeConversation ? (
            <div
              className="flex-center"
              style={{ height: "100%", flexDirection: "column", gap: "12px" }}
            >
              <p className="text-16 text-muted">
                Select a conversation or start a new one
              </p>
              <button
                onClick={handleNewConversation}
                className="btn-primary btn-sm"
              >
                <Plus size={14} /> New Conversation
              </button>
            </div>
          ) : messages.length === 0 && !streaming ? (
            <div className="flex-center" style={{ height: "100%" }}>
              <p className="text-14 text-muted">
                Type a message below to start chatting
              </p>
            </div>
          ) : (
            <div
              style={{
                maxWidth: "800px",
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {streaming && (
                <MessageBubble
                  message={{
                    id: "streaming",
                    role: "assistant",
                    content: streamingText,
                    status: "streaming",
                    selectedModel,
                    createdAt: new Date().toISOString(),
                  }}
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="alert-error"
            style={{
              margin: "0 20px 8px",
              padding: "8px 12px",
              fontSize: "12px",
            }}
          >
            {error}
            <button
              onClick={() => setError("")}
              style={{
                float: "right",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input Area */}
        <div
          style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}
        >
          {/* Pending Attachments */}
          {pendingAttachments.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                marginBottom: "8px",
              }}
            >
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="border-default bg-surface"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                >
                  {att.kind === "image" ? (
                    <ImageIcon size={12} />
                  ) : (
                    <FileText size={12} />
                  )}
                  <span>{att.filename}</span>
                  <button
                    onClick={() => removePendingAttachment(att.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--muted)",
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            {/* Attach Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!activeConversation || uploading || streaming}
              className="btn-outline"
              style={{ padding: "10px", flexShrink: 0 }}
              title={
                canAttachImages
                  ? "Attach images or documents"
                  : "Attach documents (selected model does not support images)"
              }
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Paperclip size={18} />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              accept={
                canAttachImages
                  ? ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.markdown,.csv,.json"
                  : ".pdf,.txt,.md,.markdown,.csv,.json"
              }
              onChange={(e) => {
                if (e.target.files) void handleFileSelect(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Text Input */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={
                activeConversation
                  ? "Type your message... (Enter to send, Shift+Enter for newline)"
                  : "Select or create a conversation first"
              }
              disabled={!activeConversation || streaming}
              className="input-field"
              style={{
                flex: 1,
                resize: "none",
                minHeight: "44px",
                maxHeight: "200px",
                fontSize: "14px",
                fontFamily: "inherit",
              }}
              rows={1}
            />

            {/* Send / Stop Button */}
            {streaming ? (
              <button
                onClick={handleStop}
                className="btn-outline"
                style={{
                  padding: "10px",
                  flexShrink: 0,
                  color: "var(--warning)",
                }}
                title="Stop streaming"
              >
                <StopCircle size={18} />
              </button>
            ) : (
              <button
                onClick={() => void handleSend()}
                disabled={
                  !activeConversation ||
                  (!input.trim() && pendingAttachments.length === 0)
                }
                className="btn-primary"
                style={{ padding: "10px", flexShrink: 0 }}
                title="Send message"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "75%",
          padding: "12px 16px",
          borderRadius: "12px",
          background: isUser ? "var(--accent)" : "var(--surface)",
          color: isUser ? "#fff" : "var(--text)",
          border: isUser ? "none" : "1px solid var(--border)",
        }}
      >
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              flexWrap: "wrap",
              marginBottom: "8px",
            }}
          >
            {message.attachments.map((att) => (
              <div
                key={att.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  opacity: 0.8,
                }}
              >
                {att.kind === "image" ? (
                  <ImageIcon size={12} />
                ) : (
                  <FileText size={12} />
                )}
                <span>{att.filename}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          {message.content || (isStreaming ? "..." : "")}
          {isStreaming && message.content && (
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "16px",
                background: "currentColor",
                marginLeft: "2px",
                animation: "blink 1s infinite",
                opacity: 0.6,
              }}
            />
          )}
        </div>

        {/* Model badge for assistant messages */}
        {!isUser && message.selectedModel && (
          <div style={{ marginTop: "6px", fontSize: "10px", opacity: 0.5 }}>
            {message.routedModel || message.selectedModel}
            {message.status === "interrupted" && " · interrupted"}
          </div>
        )}
      </div>
    </div>
  );
}
