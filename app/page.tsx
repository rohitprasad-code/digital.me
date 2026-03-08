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
        minHeight: "100vh",
        padding: "32px 0",
      }}
    >
      <Container size="4">
        <Flex direction="column" gap="6">
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
            columns={{ initial: "1", md: "3" }}
            gap="6"
            style={{ minHeight: "65vh" }}
          >
            {/* Left Column: Controls & Status */}
            <Flex direction="column" gap="5">
              <ContextSelector mode={mode} setMode={setMode} />
              <IntegrationStatus />
              <WeeklyReport />
            </Flex>

            {/* Right Column: Chat Interface */}
            <Box style={{ gridColumn: "span 2", height: "100%" }}>
              <ChatInterface mode={mode} />
            </Box>
          </Grid>
        </Flex>
      </Container>
    </Box>
  );
}
