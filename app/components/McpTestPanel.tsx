"use client";

import { useState, useEffect } from "react";
import { Flex, Text, Box, Button, Heading, Badge, Card } from "@radix-ui/themes";
import { PlayIcon } from "@radix-ui/react-icons";

interface McpPropertySchema {
  type?: string;
  description?: string;
}

interface McpTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, McpPropertySchema>;
    required?: string[];
  };
}

export function McpTestPanel() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedToolName, setSelectedToolName] = useState("");
  const [argsJson, setArgsJson] = useState("{}");
  const [output, setOutput] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [loadingTools, setLoadingTools] = useState(true);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const response = await fetch("/api/mcp");
        const data = await response.json();
        if (data.tools) {
          setTools(data.tools);
          if (data.tools.length > 0) {
            const firstTool = data.tools[0].name;
            setSelectedToolName(firstTool);
            const saved = localStorage.getItem(`mcp_args_${firstTool}`);
            setArgsJson(saved || getArgsPlaceholder(data.tools[0]));
          }
        }
      } catch (error) {
        console.error("Failed to load tools for tester panel:", error);
      } finally {
        setLoadingTools(false);
      }
    };
    fetchTools();
  }, []);

  const getArgsPlaceholder = (tool: McpTool) => {
    const props = tool.parameters?.properties || {};
    const placeholder: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
      const val = value as Record<string, unknown>;
      if (val.type === "string") placeholder[key] = "";
      else if (val.type === "number" || val.type === "integer") placeholder[key] = 0;
      else if (val.type === "boolean") placeholder[key] = false;
      else if (val.type === "array") placeholder[key] = [];
      else placeholder[key] = {};
    }
    return JSON.stringify(placeholder, null, 2);
  };

  const handleToolSelect = (name: string) => {
    setSelectedToolName(name);
    const selected = tools.find((t) => t.name === name);
    if (selected) {
      const saved = localStorage.getItem(`mcp_args_${name}`);
      setArgsJson(saved || getArgsPlaceholder(selected));
    }
    setOutput(null);
  };

  const handleArgsChange = (val: string) => {
    setArgsJson(val);
    if (selectedToolName) {
      localStorage.setItem(`mcp_args_${selectedToolName}`, val);
    }
  };

  const runTool = async () => {
    setRunning(true);
    setOutput(null);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(argsJson);
      } catch {
        setOutput({ error: "Invalid JSON arguments. Please check your syntax." });
        setRunning(false);
        return;
      }

      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: selectedToolName,
          arguments: parsedArgs,
        }),
      });
      const resData = await response.json();
      setOutput(resData);
    } catch (err) {
      setOutput({ error: "Execution failed", details: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  };

  const activeTool = tools.find((t) => t.name === selectedToolName);

  if (loadingTools) {
    return (
      <Flex align="center" justify="center" style={{ height: "100%", width: "100%" }}>
        <Text size="3" color="gray" className="spin">⏳</Text>
        <Text size="3" color="gray" ml="2">Discovering active MCP tools...</Text>
      </Flex>
    );
  }

  if (tools.length === 0) {
    return (
      <Flex align="center" justify="center" style={{ height: "100%", width: "100%" }}>
        <Text size="3" color="gray">No active MCP tools found.</Text>
      </Flex>
    );
  }

  return (
    <Card
      size="3"
      variant="surface"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Flex style={{ height: "100%", width: "100%", minHeight: 0, gap: "16px" }}>
        {/* Sidebar - Tools List */}
        <Box
          width="280px"
          style={{
            flexShrink: 0,
            borderRight: "1px solid var(--gray-5)",
            paddingRight: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflowY: "auto",
          }}
        >
          <Text size="1" weight="bold" color="gray" style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Registered Tools ({tools.length})
          </Text>
          
          <Flex direction="column" gap="1">
            {tools.map((t) => {
              const isActive = t.name === selectedToolName;
              return (
                <Box
                  key={t.name}
                  onClick={() => handleToolSelect(t.name)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    backgroundColor: isActive ? "var(--accent-3)" : "transparent",
                    border: isActive ? "1px solid var(--accent-6)" : "1px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                  className={!isActive ? "hover:bg-slate-800" : ""}
                >
                  <Text
                    as="div"
                    size="2"
                    weight={isActive ? "bold" : "regular"}
                    style={{
                      color: isActive ? "var(--accent-11)" : "var(--gray-11)",
                      fontFamily: "var(--font-outfit), sans-serif",
                      wordBreak: "break-all",
                    }}
                  >
                    {t.name}
                  </Text>
                </Box>
              );
            })}
          </Flex>
        </Box>

        {/* Main Workspace - Editor & Execution Results */}
        <Flex direction="column" style={{ flexGrow: 1, minHeight: 0, gap: "16px" }}>
          {/* Tool Info Header */}
          {activeTool && (
            <Box
              style={{
                padding: "16px",
                borderRadius: "12px",
                backgroundColor: "var(--color-surface-hover)",
                border: "1px solid var(--gray-5)",
              }}
            >
              <Flex align="center" gap="3" mb="2">
                <Heading size="4" style={{ fontFamily: "var(--font-outfit)" }}>
                  {activeTool.name}
                </Heading>
                <Badge color="indigo" variant="soft">
                  MCP Tool
                </Badge>
              </Flex>
              <Text size="2" color="gray" as="p">
                {activeTool.description || "No description provided."}
              </Text>

              {activeTool.parameters?.properties && Object.keys(activeTool.parameters.properties).length > 0 && (
                <Box mt="3" style={{ borderTop: "1px solid var(--gray-5)", paddingTop: "12px" }}>
                  <Text size="1" weight="bold" color="indigo" mb="2" as="div" style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    Expected Parameters:
                  </Text>
                  <Flex gap="2" wrap="wrap">
                    {Object.entries(activeTool.parameters.properties).map(([name, schema]) => {
                      const isRequired = activeTool.parameters.required?.includes(name);
                      return (
                        <Box
                          key={name}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "8px",
                            backgroundColor: "var(--color-background)",
                            border: "1px solid var(--gray-4)",
                            minWidth: "200px",
                            flex: "1 1 calc(33.333% - 8px)",
                          }}
                        >
                          <Flex align="center" justify="between" gap="2" mb="1">
                            <Text size="2" weight="bold" style={{ fontFamily: "var(--font-code)", color: "var(--accent-11)" }}>
                              {name}
                            </Text>
                            <Badge size="1" color={isRequired ? "red" : "gray"}>
                              {schema.type || "any"}{isRequired ? " • req" : ""}
                            </Badge>
                          </Flex>
                          {schema.description && (
                            <Text size="1" color="gray" style={{ display: "block", marginTop: "4px", lineHeight: "1.3" }}>
                              {schema.description}
                            </Text>
                          )}
                        </Box>
                      );
                    })}
                  </Flex>
                </Box>
              )}
            </Box>
          )}

          {/* Input/Output Split Pane */}
          <Flex gap="4" style={{ flexGrow: 1, minHeight: 0, width: "100%" }}>
            {/* Left Pane - Arguments Editor */}
            <Flex direction="column" style={{ flex: 1, minWidth: 0, gap: "8px" }}>
              <Text size="1" weight="bold" color="gray" style={{ letterSpacing: "0.05em" }}>
                ARGUMENTS (JSON)
              </Text>
              <textarea
                value={argsJson}
                onChange={(e) => handleArgsChange(e.target.value)}
                style={{
                  flexGrow: 1,
                  width: "100%",
                  padding: "12px",
                  fontFamily: "var(--font-code), monospace",
                  fontSize: "13px",
                  borderRadius: "8px",
                  border: "1px solid var(--gray-6)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-text)",
                  outline: "none",
                  resize: "none",
                }}
              />
              <Button
                onClick={runTool}
                disabled={running}
                size="3"
                style={{
                  width: "100%",
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                }}
              >
                <PlayIcon /> {running ? "Running Tool..." : "Execute tool"}
              </Button>
            </Flex>

            {/* Right Pane - Execution Terminal */}
            <Flex direction="column" style={{ flex: 1, minWidth: 0, gap: "8px" }}>
              <Text size="1" weight="bold" color="gray" style={{ letterSpacing: "0.05em" }}>
                EXECUTION TERMINAL
              </Text>
              <Box
                style={{
                  flexGrow: 1,
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor: "#09090b",
                  border: "1px solid var(--gray-6)",
                  overflowY: "auto",
                  position: "relative",
                }}
              >
                {output === null ? (
                  <Flex align="center" justify="center" style={{ height: "100%" }}>
                    <Text size="2" color="gray" style={{ fontStyle: "italic" }}>
                      Run the tool to view response payloads.
                    </Text>
                  </Flex>
                ) : (
                  <pre
                    style={{
                      fontFamily: "var(--font-code), monospace",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      color: typeof output === "object" && output !== null && "error" in output
                        ? "var(--red-11)"
                        : "var(--green-11)",
                    }}
                  >
                    {JSON.stringify(output, null, 2)}
                  </pre>
                )}
              </Box>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}
