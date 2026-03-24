"use client";

import { useState } from "react";
import { Grid, Flex, Heading, Text, Box } from "@radix-ui/themes";
import { ChatInterface } from "./components/ChatInterface";
import { ContextSelector, Mode } from "./components/ContextSelector";
import { IntegrationStatus } from "./components/IntegrationStatus";
import { WeeklyReport } from "./components/WeeklyReport";

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>("default");

  return (
    <Box
      className="main-dashboard-wrap"
      style={{
        backgroundColor: "var(--color-background)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Flex
        direction="column"
        gap={{ initial: "4", md: "6" }}
        style={{ height: "100%" }}
      >
        {/* Dashboard Header */}
        <Flex justify="between" align="end" wrap="wrap" gap="4">
          <Box>
            <Heading
              size={{ initial: "6", md: "8" }}
              mb="2"
              style={{ letterSpacing: "-0.02em" }}
            >
              Digital Me Control Panel
            </Heading>
            <Text size="3" color="gray">
              Manage router contexts, view sync statuses, and simulate
              interactions.
            </Text>
          </Box>
        </Flex>

        {/* Main Dashboard Layout */}
        <Flex
          wrap="wrap"
          gap="5"
          style={{ flexGrow: 1, minHeight: 0 }}
        >
          {/* Left Column: Controls & Status */}
          <Box style={{ flexBasis: "350px", flexGrow: 1, maxWidth: "100%" }}>
            <Flex
              direction="column"
              justify="start"
              gap="5"
              style={{ overflowY: "auto" }}
            >
              <Flex direction="column" gap="5">
                <ContextSelector mode={mode} setMode={setMode} />
                <IntegrationStatus />
              </Flex>
              <WeeklyReport />
            </Flex>
          </Box>

          {/* Right Column: Chat Interface */}
          <Box
            style={{
              flexBasis: "350px",
              flexGrow: 9999,
              minHeight: "500px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <ChatInterface mode={mode} setMode={setMode} />
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
}
