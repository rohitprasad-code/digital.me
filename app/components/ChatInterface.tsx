"use client";

import { useState, useRef, useEffect } from "react";
import {
  ScrollArea,
  TextField,
  IconButton,
  Box,
  Flex,
  Text,
  Card,
  Avatar,
  Select,
} from "@radix-ui/themes";
import { PaperPlaneIcon } from "@radix-ui/react-icons";
import { Mode } from "./ContextSelector";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

interface ChatInterfaceProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export function ChatInterface({ mode, setMode }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm Rohit's Digital Twin 🚀\nI can tell you about my engineering work, or we can just chat. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedModel, setSelectedModel] = useState<string>("groq");
  const viewportRef = useRef<HTMLDivElement>(null);

  // Free Tier Rate Limiting & Developer Authentication
  const [passcode, setPasscode] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [freeMessagesCount, setFreeMessagesCount] = useState(0);
  const [showAuthForm, setShowAuthForm] = useState(false);

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch("/api/models");
        const data = await res.json();
        setAvailableModels(data.models || []);
        if (data.models?.length > 0) {
          setSelectedModel(data.models[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch available models", err);
      }
    }
    fetchModels();

    // Load auth variables from localStorage
    const savedPasscode = localStorage.getItem("dev_passcode") || "";
    const savedCustomKey = localStorage.getItem("custom_api_key") || "";
    setPasscode(savedPasscode);
    setCustomKey(savedCustomKey);
    if (savedPasscode === "developer" || savedCustomKey.trim().length > 0) {
      setIsAuthenticated(true);
    }

    // Read cookie to set local free count
    const count = document.cookie
      .split("; ")
      .find((row) => row.startsWith("free_chat_count="))
      ?.split("=")[1];
    if (count) {
      setFreeMessagesCount(parseInt(count, 10));
    }
  }, []);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Enforce front-end limit check
    if (!isAuthenticated && freeMessagesCount >= 5) {
      return;
    }

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (passcode) {
        headers["x-auth-passcode"] = passcode;
      }
      if (customKey) {
        headers["x-custom-api-key"] = customKey;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [...messages, userMessage],
          mode,
          provider: selectedModel,
        }),
      });

      if (response.status === 429) {
        setFreeMessagesCount(5);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "⚠️ Free tier limit reached. Please authenticate in the panel below to unlock unlimited conversations.",
          },
        ]);
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage += chunk;

        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantMessage;
          return newMessages;
        });
      }

      if (!isAuthenticated) {
        setFreeMessagesCount((prev) => Math.min(5, prev + 1));
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Connection interrupted." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      size="3"
      variant="surface"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Flex direction="column" height="100%">
        {/* Messages Auto-scroll Area */}
        <ScrollArea
          type="auto"
          scrollbars="vertical"
          style={{ flexGrow: 1, paddingRight: "16px", marginBottom: "16px" }}
        >
          <div
            ref={viewportRef}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              paddingBottom: "16px",
            }}
          >
            {messages.map((msg, index) => (
              <Flex key={index} justify={msg.role === "user" ? "end" : "start"}>
                {msg.role === "assistant" && (
                  <Avatar
                    fallback="RP"
                    size="2"
                    color="indigo"
                    radius="full"
                    mr="2"
                  />
                )}
                <Box
                  style={{
                    maxWidth: "85%",
                    backgroundColor:
                      msg.role === "user" ? "var(--indigo-9)" : "var(--gray-3)",
                    color: msg.role === "user" ? "white" : "var(--gray-12)",
                    borderRadius: "12px",
                    borderTopRightRadius: msg.role === "user" ? "2px" : "12px",
                    borderTopLeftRadius:
                      msg.role === "assistant" ? "2px" : "12px",
                    padding: "12px 16px",
                  }}
                >
                  <Text
                    size="2"
                    style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}
                  >
                    {msg.content}
                  </Text>
                </Box>
              </Flex>
            ))}

            {isLoading && (
              <Flex justify="start">
                <Avatar
                  fallback="RP"
                  size="2"
                  color="indigo"
                  radius="full"
                  mr="2"
                />
                <Box
                  style={{
                    backgroundColor: "var(--gray-3)",
                    borderRadius: "12px",
                    borderTopLeftRadius: "2px",
                    padding: "12px 16px",
                  }}
                >
                  <Text size="2" color="gray" className="animate-pulse">
                    Thinking...
                  </Text>
                </Box>
              </Flex>
            )}
          </div>
        </ScrollArea>

        {/* Input Form & Locked Overlay */}
        {!isAuthenticated && freeMessagesCount >= 5 ? (
          <Box
            style={{
              marginTop: "auto",
              padding: "20px",
              border: "1px dashed var(--indigo-5)",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(168, 85, 247, 0.04) 100%)",
              backdropFilter: "blur(4px)",
            }}
          >
            <Flex direction="column" gap="2" align="center" style={{ textAlign: "center" }}>
              <Text size="3" weight="bold" color="indigo">
                🔒 Free Message Limit Reached
              </Text>
              <Text size="1" color="gray" style={{ maxWidth: "340px" }}>
                You have sent all 5 free messages. Unlock unlimited chats with Rohit&apos;s Digital Twin by entering a passcode or an API key below.
              </Text>
              <Flex direction="column" gap="2" width="100%" mt="2">
                <TextField.Root
                  placeholder="Enter passcode (e.g. developer)..."
                  type="password"
                  size="2"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "developer") {
                      localStorage.setItem("dev_passcode", "developer");
                      setPasscode("developer");
                      setIsAuthenticated(true);
                      setFreeMessagesCount(0);
                    }
                  }}
                />
                <Text size="1" color="gray">
                  Or enter your own Groq/Gemini API Key:
                </Text>
                <TextField.Root
                  placeholder="Groq or Gemini API Key..."
                  size="2"
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (val.startsWith("gsk_") || val.startsWith("AIzaSy")) {
                      localStorage.setItem("custom_api_key", val);
                      setCustomKey(val);
                      setIsAuthenticated(true);
                      setFreeMessagesCount(0);
                    }
                  }}
                />
              </Flex>
            </Flex>
          </Box>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: "auto" }}>
            <TextField.Root
              size="3"
              placeholder="Send a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            >
              <TextField.Slot pr="1" side="right">
                <IconButton
                  size="2"
                  variant="solid"
                  color="indigo"
                  type="submit"
                  disabled={!input.trim() || isLoading}
                >
                  <PaperPlaneIcon />
                </IconButton>
              </TextField.Slot>
            </TextField.Root>
            <Flex
              direction={{ initial: "column", md: "row" }}
              justify="between"
              align={{ initial: "start", md: "center" }}
              mt="2"
              gap="2"
            >
              <Flex align="center" gap="4" wrap="wrap">
                <Flex align="center" gap="2">
                  <Text size="1" color="gray">
                    Context Mode:
                  </Text>
                  <Select.Root
                    size="1"
                    value={mode}
                    onValueChange={(val) => setMode(val as Mode)}
                  >
                    <Select.Trigger variant="ghost" />
                    <Select.Content>
                      <Select.Item value="default">Auto</Select.Item>
                      <Select.Item value="recruiter">Recruiter</Select.Item>
                      <Select.Item value="social">Friend</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>

                <Flex align="center" gap="2">
                  {isAuthenticated ? (
                    <Text size="1" color="green" weight="bold">
                      ✓ Unlimited Access
                    </Text>
                  ) : (
                    <Text
                      size="1"
                      color="indigo"
                      style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => setShowAuthForm(!showAuthForm)}
                    >
                      🔒 Free Tier: {5 - freeMessagesCount} left
                    </Text>
                  )}
                </Flex>
              </Flex>
              {availableModels.length > 0 && (
                <Flex align="center" gap="2">
                  <Text size="1" color="gray">
                    LLM Provider:
                  </Text>
                  <Select.Root
                    size="1"
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <Select.Trigger variant="ghost" />
                    <Select.Content>
                      {availableModels.map((m) => (
                        <Select.Item key={m.id} value={m.id}>
                          {m.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Flex>
              )}
            </Flex>
          </form>
        )}

        {/* Collapsible Authentication Form */}
        {showAuthForm && !isAuthenticated && (
          <Card variant="classic" style={{ marginTop: "8px", padding: "12px" }}>
            <Flex direction="column" gap="2">
              <Text size="1" weight="bold" color="indigo">
                Developer Authentication Panel
              </Text>
              <Text size="1" color="gray">
                Enter passcode or custom API key to enable unlimited messages.
              </Text>
              <Flex gap="2">
                <TextField.Root
                  placeholder="Passcode..."
                  type="password"
                  style={{ flexGrow: 1 }}
                  size="1"
                  onChange={(e) => {
                    if (e.target.value === "developer") {
                      localStorage.setItem("dev_passcode", "developer");
                      setPasscode("developer");
                      setIsAuthenticated(true);
                      setFreeMessagesCount(0);
                      setShowAuthForm(false);
                    }
                  }}
                />
                <TextField.Root
                  placeholder="API Key..."
                  style={{ flexGrow: 1 }}
                  size="1"
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (val.startsWith("gsk_") || val.startsWith("AIzaSy")) {
                      localStorage.setItem("custom_api_key", val);
                      setCustomKey(val);
                      setIsAuthenticated(true);
                      setFreeMessagesCount(0);
                      setShowAuthForm(false);
                    }
                  }}
                />
                <IconButton
                  size="1"
                  color="gray"
                  variant="ghost"
                  onClick={() => setShowAuthForm(false)}
                >
                  ✕
                </IconButton>
              </Flex>
            </Flex>
          </Card>
        )}
      </Flex>
    </Card>
  );
}
