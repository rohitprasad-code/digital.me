"use client";

import { useState, useEffect } from "react";
import { Card, Flex, Text, Box, Button } from "@radix-ui/themes";
import { PlayIcon, ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";

interface McpTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export function McpTestPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
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
            setSelectedToolName(data.tools[0].name);
            setArgsJson(getArgsPlaceholder(data.tools[0]));
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

  const handleToolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedToolName(name);
    const selected = tools.find((t) => t.name === name);
    if (selected) {
      setArgsJson(getArgsPlaceholder(selected));
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

  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="3">
        <Flex
          justify="between"
          align="center"
          style={{ cursor: "pointer" }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Box>
            <Text as="div" size="3" weight="bold">
              MCP Interactive Playground
            </Text>
            <Text size="2" color="gray">
              Inspect and test registered tools in real-time
            </Text>
          </Box>
          <Box>{isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}</Box>
        </Flex>

        {isExpanded && (
          <Flex direction="column" gap="3">
            {loadingTools ? (
              <Text size="2" color="gray">Discovering active tools...</Text>
            ) : tools.length === 0 ? (
              <Text size="2" color="gray">No active MCP tools found.</Text>
            ) : (
              <Flex direction="column" gap="3">
                <Box>
                  <Text as="div" size="1" weight="bold" color="gray" mb="1">
                    SELECT TOOL
                  </Text>
                  <select
                    value={selectedToolName}
                    onChange={handleToolChange}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "6px",
                      border: "1px solid var(--gray-7)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  >
                    {tools.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Box>

                {activeTool && activeTool.description && (
                  <Box
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      backgroundColor: "var(--gray-3)",
                      borderLeft: "3px solid var(--accent-9)",
                    }}
                  >
                    <Text size="2" color="gray" style={{ fontStyle: "italic" }}>
                      {activeTool.description}
                    </Text>
                  </Box>
                )}

                <Box>
                  <Text as="div" size="1" weight="bold" color="gray" mb="1">
                    ARGUMENTS (JSON)
                  </Text>
                  <textarea
                    value={argsJson}
                    onChange={(e) => setArgsJson(e.target.value)}
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "8px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      borderRadius: "6px",
                      border: "1px solid var(--gray-7)",
                      backgroundColor: "var(--color-surface)",
                      color: "var(--color-text)",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </Box>

                <Button onClick={runTool} disabled={running} size="2">
                  <PlayIcon /> {running ? "Executing..." : "Execute Tool"}
                </Button>

                {output && (
                  <Box>
                    <Text as="div" size="1" weight="bold" color="gray" mb="1">
                      EXECUTION RESULT
                    </Text>
                    <pre
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        backgroundColor: "var(--gray-3)",
                        border: "1px solid var(--gray-5)",
                        fontSize: "11px",
                        fontFamily: "monospace",
                        overflowX: "auto",
                        maxHeight: "200px",
                        color: typeof output === "object" && output !== null && "error" in output
                          ? "var(--red-11)"
                          : "var(--green-11)",
                      }}
                    >
                      {JSON.stringify(output, null, 2)}
                    </pre>
                  </Box>
                )}
              </Flex>
            )}
          </Flex>
        )}
      </Flex>
    </Card>
  );
}
