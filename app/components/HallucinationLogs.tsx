"use client";

import { useState, useEffect } from "react";
import { Card, Flex, Text, Box, Badge, Button, Separator } from "@radix-ui/themes";
import { ReloadIcon, CheckCircledIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";

interface HallucinationLog {
  id: string;
  query: string;
  response: string;
  isSafe: boolean;
  feedback: string | null;
  createdAt: string;
  corrected?: boolean;
}

export function HallucinationLogs() {
  const [logs, setLogs] = useState<HallucinationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [correcting, setCorrecting] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hallucinations");
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to fetch hallucination logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const runSelfCorrection = async () => {
    setCorrecting(true);
    try {
      const res = await fetch("/api/hallucinations/correct", {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        fetchLogs();
      }
    } catch (err) {
      console.error("Failed to run correction:", err);
    } finally {
      setCorrecting(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Card size="3" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Flex direction="column" gap="4" style={{ height: "100%" }}>
        {/* Title & Reload */}
        <Flex justify="between" align="center">
          <Box>
            <Text size="5" weight="bold">
              Grounding & Hallucination Logs
            </Text>
            <Text size="2" color="gray" as="div">
              Real-time logs from the grounding guardrail middleware showing factual consistency checks.
            </Text>
          </Box>
          <Flex gap="2">
            <Button variant="solid" color="indigo" onClick={runSelfCorrection} disabled={correcting || loading}>
              <ReloadIcon className={correcting ? "spin" : ""} /> {correcting ? "Correcting..." : "Run Self-Correction"}
            </Button>
            <Button variant="soft" onClick={fetchLogs} disabled={loading || correcting}>
              <ReloadIcon className={loading ? "spin" : ""} /> Refresh
            </Button>
          </Flex>
        </Flex>

        {/* Info Header */}
        <Flex gap="4" wrap="wrap" style={{ backgroundColor: "var(--gray-2)", padding: "12px", borderRadius: "8px" }}>
          <Box style={{ flex: 1 }}>
            <Text size="2" weight="bold" color="green" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircledIcon /> Grounded Responses
            </Text>
            <Text size="1" color="gray">
              Responses matching semantic memory facts are released directly to the user.
            </Text>
          </Box>
          <Separator size="1" orientation="vertical" />
          <Box style={{ flex: 1 }}>
            <Text size="2" weight="bold" color="red" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ExclamationTriangleIcon /> Hallucination Triggers
            </Text>
            <Text size="1" color="gray">
              Grounding check violations automatically trigger a correction loop rewrite.
            </Text>
          </Box>
        </Flex>

        {/* Log list */}
        <Box style={{ flexGrow: 1, overflowY: "auto", maxHeight: "60vh" }}>
          {loading ? (
            <Flex justify="center" align="center" style={{ height: "200px" }}>
              <Text size="3" color="gray">
                Loading guardrail checks...
              </Text>
            </Flex>
          ) : logs.length === 0 ? (
            <Flex justify="center" align="center" style={{ height: "200px", border: "1px dashed var(--gray-5)", borderRadius: "8px" }}>
              <Text size="3" color="gray">
                No factual verification logs found. Interact with the chat to generate logs.
              </Text>
            </Flex>
          ) : (
            <Flex direction="column" gap="4">
              {logs.map((log) => (
                <Card
                  key={log.id}
                  variant="surface"
                  style={{
                    borderLeft: log.isSafe
                      ? "4px solid var(--green-9)"
                      : log.corrected
                      ? "4px solid var(--indigo-9)"
                      : "4px solid var(--red-9)",
                    backgroundColor: log.isSafe
                      ? "var(--green-2)"
                      : log.corrected
                      ? "var(--indigo-2)"
                      : "var(--red-2)",
                  }}
                >
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                      <Flex gap="2" align="center">
                        <Badge color={log.isSafe ? "green" : log.corrected ? "indigo" : "red"}>
                          {log.isSafe
                            ? "Grounded (Passed)"
                            : log.corrected
                            ? "Hallucination Detected (Corrected)"
                            : "Hallucination Detected (Pending)"}
                        </Badge>
                        <Text size="1" color="gray">
                          {new Date(log.createdAt).toLocaleString()}
                        </Text>
                      </Flex>
                    </Flex>

                    <Box>
                      <Text size="1" weight="bold" color="gray" style={{ textTransform: "uppercase" }}>
                        User Query
                      </Text>
                      <Text size="2" style={{ fontWeight: 500 }} as="div">
                        {log.query}
                      </Text>
                    </Box>

                    <Box>
                      <Text size="1" weight="bold" color="gray" style={{ textTransform: "uppercase" }}>
                        Agent Response
                      </Text>
                      <Text
                        size="2"
                        as="div"
                        style={{
                          backgroundColor: "var(--color-background)",
                          padding: "8px",
                          borderRadius: "4px",
                          fontFamily: "monospace",
                          fontSize: "12px",
                          marginTop: "4px",
                          border: "1px solid var(--gray-4)"
                        }}
                      >
                        {log.response}
                      </Text>
                    </Box>

                    {log.feedback && (
                      <Box style={{ backgroundColor: "var(--gray-3)", padding: "8px", borderRadius: "4px", marginTop: "4px" }}>
                        <Text size="1" weight="bold" color={log.isSafe ? "gray" : "red"} style={{ textTransform: "uppercase", display: "block", marginBottom: "2px" }}>
                          Verification Feedback
                        </Text>
                        <Text size="1" color="gray">
                          {log.feedback}
                        </Text>
                      </Box>
                    )}
                  </Flex>
                </Card>
              ))}
            </Flex>
          )}
        </Box>
      </Flex>
    </Card>
  );
}
