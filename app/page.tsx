"use client";

import { useState } from "react";
import { Container, Grid, Flex, Heading, Text, Box } from "@radix-ui/themes";
import { ChatInterface } from "./components/ChatInterface";
import { ContextSelector, Mode } from "./components/ContextSelector";
import { IntegrationStatus } from "./components/IntegrationStatus";
import { WeeklyReport } from "./components/WeeklyReport";

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>("default");

  return (
    <Box
      style={{
        backgroundColor: "var(--color-background)",
        height: "100vh",
        padding: "24px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Flex direction="column" gap="6" style={{ height: "100%" }}>
        {/* Dashboard Header */}
        <Flex justify="between" align="end" wrap="wrap" gap="4">
          <Box>
            <Heading size="8" mb="2" style={{ letterSpacing: "-0.02em" }}>
              Digital Twin Control Panel
            </Heading>
            <Text size="3" color="gray">
              Manage router contexts, view sync statuses, and simulate
              interactions.
            </Text>
          </Box>
        </Flex>

        {/* Main Dashboard Grid */}
        <Grid
          columns={{ initial: "1", md: "4" }}
          gap="6"
          style={{ flexGrow: 1, minHeight: 0 }}
        >
          {/* Left Column: Controls & Status */}
          <Flex
            direction="column"
            justify="between"
            gap="5"
            style={{ overflowY: "auto", paddingRight: "8px" }}
          >
            <Flex direction="column" gap="5">
              <ContextSelector mode={mode} setMode={setMode} />
              <IntegrationStatus />
            </Flex>
            <WeeklyReport />
          </Flex>

          {/* Right Column: Chat Interface */}
          <Box style={{ gridColumn: "span 3", height: "100%", minHeight: 0 }}>
            <ChatInterface mode={mode} setMode={setMode} />
          </Box>
        </Grid>
      </Flex>
    </Box>
  );
}
