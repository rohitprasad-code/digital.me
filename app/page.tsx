"use client";

import { useState } from "react";
import { Flex, Heading, Text, Box, Button, SegmentedControl } from "@radix-ui/themes";
import { ChatInterface } from "./components/ChatInterface";
import { ContextSelector, Mode } from "./components/ContextSelector";
import { IntegrationStatus } from "./components/IntegrationStatus";
import { McpTestPanel } from "./components/McpTestPanel";
import { WeeklyReport } from "./components/WeeklyReport";
import { MemoryExplorer } from "./components/MemoryExplorer";
import { HallucinationLogs } from "./components/HallucinationLogs";

import { GearIcon, BellIcon } from "@radix-ui/react-icons";

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>("default");
  const [activeTab, setActiveTab] = useState<"chat" | "memory" | "playground" | "logs">("chat");

  return (
    <Box
      className="main-dashboard-wrap"
      style={{
        backgroundColor: "var(--color-background)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Top Header */}
      <Flex
        justify="between"
        align="center"
        px="4"
        style={{
          height: "64px",
          borderBottom: "1px solid var(--gray-5)",
          backgroundColor: "var(--color-surface)",
          flexShrink: 0,
        }}
      >
        <Flex align="center" gap="3">
          <Heading
            size="5"
            style={{
              letterSpacing: "-0.02em",
              fontWeight: 800,
              color: "var(--accent-9)",
            }}
          >
            DIGITAL-ME DASHBOARD
          </Heading>
        </Flex>

        {/* Unified Global Control Zone */}
        <Flex align="center" gap="4">
          <ContextSelector mode={mode} setMode={setMode} compact={true} />
          
          <Flex
            align="center"
            gap="3"
            style={{
              borderLeft: "1px solid var(--gray-5)",
              paddingLeft: "16px",
            }}
          >
            <Button variant="ghost" size="2" style={{ color: "var(--gray-11)" }}>
              <GearIcon width="18" height="18" />
            </Button>
            <Button variant="ghost" size="2" style={{ color: "var(--gray-11)", position: "relative" }}>
              <BellIcon width="18" height="18" />
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  right: "2px",
                  width: "6px",
                  height: "6px",
                  backgroundColor: "var(--red-9)",
                  borderRadius: "50%",
                }}
              />
            </Button>
            <Box
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                overflow: "hidden",
                border: "1px solid var(--gray-6)",
              }}
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrmtHRFYflVXYRJyolNU7eEZ15Wf_i89PmDyrStHu6Gb1q9qOOp4j8wwhc-y4svBd7Tkca6nEiuh3PuY4vAkCgQOO5cbUp_bmAgqGr2bL3wUehOKNrrcLXy5_LijwEHc5KzxHQxUdoQw9jl29VhXuJ35FV-2EKeQd_gpdy1LHZ5YjhKkYSLfFnRbkl3b6l38mPYW999bYb4l7fYx7Avx2gzOlhFCAc8CE_IA1IV75DcBJeGDvsM54T"
                alt="User avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </Box>
          </Flex>
        </Flex>
      </Flex>

      {/* Main Content Area */}
      <Flex style={{ flexGrow: 1, minHeight: 0, width: "100%" }}>
        {/* Left Column: SideNavBar */}
        <Box
          width="320px"
          style={{
            flexShrink: 0,
            borderRight: "1px solid var(--gray-5)",
            backgroundColor: "var(--color-surface-hover)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: "16px",
            gap: "24px",
          }}
        >
          <IntegrationStatus />
          <WeeklyReport />
          
          <Box style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--gray-5)" }}>
            <Text size="1" color="gray">
              System Core V2.4.0
            </Text>
          </Box>
        </Box>

        {/* Right Column: Tabbed Workspace */}
        <Box
          style={{
            flexGrow: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--color-background)",
          }}
        >
          {/* Tab Headers */}
          <Flex
            align="center"
            justify="between"
            px="4"
            style={{
              height: "56px",
              borderBottom: "1px solid var(--gray-4)",
              backgroundColor: "var(--color-surface)",
              flexShrink: 0,
            }}
          >
            <SegmentedControl.Root
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as "chat" | "memory" | "playground" | "logs")}
              size="2"
            >
              <SegmentedControl.Item value="chat">💬 Chat</SegmentedControl.Item>
              <SegmentedControl.Item value="memory">🔍 Memory</SegmentedControl.Item>
              <SegmentedControl.Item value="playground">🔧 Playground</SegmentedControl.Item>
              <SegmentedControl.Item value="logs">⚠️ Logs</SegmentedControl.Item>
            </SegmentedControl.Root>

            <Flex align="center" gap="2">
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  backgroundColor: "var(--teal-3)",
                  color: "var(--teal-11)",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  textTransform: "uppercase",
                }}
              >
                Surrogate Live
              </span>
            </Flex>
          </Flex>

          {/* Tab Contents */}
          <Box
            style={{
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              margin: "16px",
            }}
          >
            <Box style={{ display: activeTab === "chat" ? "flex" : "none", flexGrow: 1, flexDirection: "column", minHeight: 0 }}>
              <ChatInterface mode={mode} setMode={setMode} />
            </Box>
            <Box style={{ display: activeTab === "memory" ? "flex" : "none", flexGrow: 1, flexDirection: "column", minHeight: 0 }}>
              <MemoryExplorer />
            </Box>
            <Box style={{ display: activeTab === "playground" ? "flex" : "none", flexGrow: 1, flexDirection: "column", minHeight: 0 }}>
              <McpTestPanel />
            </Box>
            <Box style={{ display: activeTab === "logs" ? "flex" : "none", flexGrow: 1, flexDirection: "column", minHeight: 0 }}>
              <HallucinationLogs />
            </Box>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
