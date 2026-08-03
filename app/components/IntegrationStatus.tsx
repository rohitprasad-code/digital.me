"use client";

import { useEffect, useState } from "react";
import { Card, Flex, Text, Badge, Box } from "@radix-ui/themes";
import {
  GitHubLogoIcon,
  GlobeIcon,
  ActivityLogIcon,
} from "@radix-ui/react-icons";

interface McpServerStatus {
  name: string;
  status: string;
  color: string;
}

export function IntegrationStatus() {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/mcp");
      const data = await response.json();
      if (data.servers) {
        setServers(data.servers);
      }
    } catch (error) {
      console.error("Failed to fetch MCP statuses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const getIconForServer = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("github")) return <GitHubLogoIcon />;
    if (lower.includes("strava")) return <ActivityLogIcon />;
    return <GlobeIcon />;
  };

  const getDisplayName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower === "strava") return "Strava Sync";
    if (lower === "github") return "GitHub Activity";
    if (lower === "presence-monitor") return "Presence Monitor";
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="3">
        <Flex
          justify="between"
          align="center"
          className="collapsible-header"
        >
          <Box>
            <Text as="div" size="3" weight="bold">
              System Integrations
            </Text>
            <Text size="2" color="gray">
              Live status of connected MCP servers
            </Text>
          </Box>
        </Flex>

        <Box>
          {loading ? (
            <Text size="2" color="gray">Loading status...</Text>
          ) : servers.length === 0 ? (
            <Text size="2" color="gray">No MCP integrations configured.</Text>
          ) : (
            <Flex direction="column" gap="3">
              {servers.map((server, idx) => (
                <Flex key={idx} justify="between" align="center">
                  <Flex align="center" gap="2">
                    <Box style={{ color: `var(--${server.color}-9)` }}>
                      {getIconForServer(server.name)}
                    </Box>
                    <Text size="2" weight="medium">
                      {getDisplayName(server.name)}
                    </Text>
                  </Flex>
                  {/* @ts-expect-error - Radix UI badge color prop typing workaround */}
                  <Badge color={server.color} radius="full" variant="soft">
                    {server.status}
                  </Badge>
                </Flex>
              ))}
            </Flex>
          )}
        </Box>
      </Flex>
    </Card>
  );
}
