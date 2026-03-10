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
  }, []);

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          mode,
          provider: selectedModel,
        }),
      });

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

        {/* Input Form */}
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
          <Flex justify="between" align="center" mt="2">
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
      </Flex>
    </Card>
  );
}
