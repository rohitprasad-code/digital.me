"use client";

import { useState } from "react";
import {
  Card,
  Button,
  Text,
  Dialog,
  Flex,
  ScrollArea,
  Tooltip,
} from "@radix-ui/themes";
import { FileTextIcon, UpdateIcon } from "@radix-ui/react-icons";

export function WeeklyReport() {
  const [reportData, setReportData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Example fetch; real hook would pull from /api/report
  const handleFetchReport = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/report");
      if (!res.ok) throw new Error("No report");
      const text = await res.text();
      setReportData(text);
    } catch (err) {
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

          <Dialog.Content style={{ maxWidth: 600 }}>
            <Dialog.Title>Weekly Report summary</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Here is what Rohit was up to recently.
            </Dialog.Description>

            <ScrollArea
              type="always"
              scrollbars="vertical"
              style={{ height: 300 }}
            >
              <Flex direction="column" gap="3" pr="4">
                {loading ? (
                  <Flex justify="center" align="center" style={{ height: 200 }}>
                    <UpdateIcon
                      className="animate-spin text-gray-400"
                      width="24"
                      height="24"
                    />
                  </Flex>
                ) : (
                  <Text
                    as="p"
                    size="2"
                    style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}
                  >
                    {reportData}
                  </Text>
                )}
              </Flex>
            </ScrollArea>

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
