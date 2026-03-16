"use client";

import { useState } from "react";
import {
  Card,
  Button,
  Text,
  Dialog,
  Flex,
  Tooltip,
  SegmentedControl,
  Box,
} from "@radix-ui/themes";
import {
  FileTextIcon,
  UpdateIcon,
  ReaderIcon,
  CodeIcon,
} from "@radix-ui/react-icons";
import ReactMarkdown from "react-markdown";

export function WeeklyReport() {
  const [reportData, setReportData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");

  // Example fetch; real hook would pull from /api/report
  const handleFetchReport = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/report");
      if (!res.ok) throw new Error("No report");
      const text = await res.text();
      setReportData(text);
    } catch {
      setReportData(
        "No reports found for this week yet. Digital-Me is still aggregating activity.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="3">
        <Text as="div" size="3" weight="bold">
          Analytics & Reports
        </Text>
        <Text size="2" color="gray">
          Generate or view your automated weekly highlight summaries.
        </Text>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger>
            <Button variant="soft" color="indigo" onClick={handleFetchReport}>
              <FileTextIcon /> View Latest Report
            </Button>
          </Dialog.Trigger>

          <Dialog.Content style={{ maxWidth: 650 }}>
            <Flex justify="between" align="start" mb="4">
              <Box>
                <Dialog.Title>Weekly Report summary</Dialog.Title>
                <Dialog.Description size="2">
                  Here is what Rohit was up to recently.
                </Dialog.Description>
              </Box>

              {!loading && reportData && (
                <SegmentedControl.Root
                  value={viewMode}
                  onValueChange={(val: string) =>
                    setViewMode(val as "rendered" | "raw")
                  }
                  size="1"
                >
                  <SegmentedControl.Item value="rendered">
                    <Flex align="center" gap="1">
                      <ReaderIcon /> Reader
                    </Flex>
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="raw">
                    <Flex align="center" gap="1">
                      <CodeIcon /> Raw
                    </Flex>
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              )}
            </Flex>

            <Box
              style={{
                maxHeight: 400,
                overflowY: "auto",
                scrollbarWidth: "none", // Firefox
                msOverflowStyle: "none", // IE/Edge
              }}
              // Add a generic class to apply webkit scrollbar hiding
              className="no-scrollbar"
            >
              <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
              {loading ? (
                <Flex
                  justify="center"
                  align="center"
                  style={{ height: "100%", minHeight: 200 }}
                >
                  <UpdateIcon
                    className="animate-spin text-gray-400"
                    width="24"
                    height="24"
                  />
                </Flex>
              ) : (
                <Box
                  style={{
                    backgroundColor: "var(--gray-2)",
                    borderRadius: "8px",
                    padding: "24px",
                    border: "1px solid var(--gray-6)",
                    boxShadow: "inset 0 1px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <Box
                    className="markdown-prose"
                    style={{
                      color: "var(--gray-12)",
                      fontSize: "0.95rem",
                      lineHeight: "1.6",
                    }}
                  >
                    {viewMode === "raw" ? (
                      <Text
                        as="p"
                        size="2"
                        style={{
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                          color: "var(--gray-11)",
                        }}
                      >
                        {reportData}
                      </Text>
                    ) : (
                      <ReactMarkdown
                        components={{
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          h1: ({ ...props }: any) => (
                            <h1
                              style={{
                                fontSize: "1.5em",
                                fontWeight: "bold",
                                marginTop: "1em",
                                marginBottom: "0.5em",
                                color: "var(--indigo-11)",
                              }}
                              {...props}
                            />
                          ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          h2: ({ ...props }: any) => (
                            <h2
                              style={{
                                fontSize: "1.25em",
                                fontWeight: "bold",
                                marginTop: "1em",
                                marginBottom: "0.5em",
                                borderBottom: "1px solid var(--gray-5)",
                                paddingBottom: "0.25em",
                                color: "var(--gray-12)",
                              }}
                              {...props}
                            />
                          ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          h3: ({ ...props }: any) => (
                            <h3
                              style={{
                                fontSize: "1.1em",
                                fontWeight: "bold",
                                marginTop: "1em",
                                marginBottom: "0.5em",
                              }}
                              {...props}
                            />
                          ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          ul: ({ ...props }: any) => (
                            <ul
                              style={{
                                listStyleType: "disc",
                                paddingLeft: "2em",
                                marginBottom: "1em",
                              }}
                              {...props}
                            />
                          ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          ol: ({ ...props }: any) => (
                            <ol
                              style={{
                                listStyleType: "decimal",
                                paddingLeft: "2em",
                                marginBottom: "1em",
                              }}
                              {...props}
                            />
                          ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          li: ({ ...props }: any) => (
                            <li style={{ marginBottom: "0.25em" }} {...props} />
                          ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          p: ({ ...props }: any) => (
                            <p style={{ marginBottom: "1em" }} {...props} />
                          ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          a: ({ ...props }: any) => (
                            <a
                              style={{
                                color: "var(--blue-10)",
                                textDecoration: "underline",
                              }}
                              {...props}
                            />
                          ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          code: ({ inline, ...props }: any) =>
                            inline ? (
                              <code
                                style={{
                                  backgroundColor: "var(--gray-4)",
                                  padding: "0.2em 0.4em",
                                  borderRadius: "3px",
                                  fontSize: "0.85em",
                                  fontFamily: "monospace",
                                }}
                                {...props}
                              />
                            ) : (
                              <Box
                                style={{
                                  backgroundColor: "var(--gray-3)",
                                  padding: "1em",
                                  borderRadius: "6px",
                                  overflowX: "auto",
                                  marginBottom: "1em",
                                  border: "1px solid var(--gray-5)",
                                }}
                              >
                                <code
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: "0.85em",
                                  }}
                                  {...props}
                                />
                              </Box>
                            ),
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          blockquote: ({ ...props }: any) => (
                            <blockquote
                               style={{
                                 borderLeft: "3px solid var(--indigo-8)",
                                 paddingLeft: "1em",
                                 color: "var(--gray-11)",
                                 fontStyle: "italic",
                                 margin: "1em 0",
                               }}
                               {...props}
                             />
                          ),
                        }}
                      >
                        {reportData || ""}
                      </ReactMarkdown>
                    )}
                  </Box>
                </Box>
              )}
            </Box>

            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Close
                </Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>

        <Tooltip content="Forces an immediate regeneration of the report.">
          <Button variant="outline" color="gray">
            <UpdateIcon /> Force Sync Now
          </Button>
        </Tooltip>
      </Flex>
    </Card>
  );
}
