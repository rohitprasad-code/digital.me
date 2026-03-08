"use client";

import { Card, Flex, Text, Badge, Separator, Box } from "@radix-ui/themes";
import {
  GitHubLogoIcon,
  InstagramLogoIcon,
  GlobeIcon,
  ActivityLogIcon,
} from "@radix-ui/react-icons";

export function IntegrationStatus() {
  const integrations = [
    {
      name: "Strava Sync",
      icon: <ActivityLogIcon />,
      status: "Online",
      color: "orange",
    },
    {
      name: "GitHub Activity",
      icon: <GitHubLogoIcon />,
      status: "Online",
      color: "gray",
    },
    {
      name: "Instagram",
      icon: <InstagramLogoIcon />,
      status: "Syncing...",
      color: "pink",
    },
    {
      name: "ESP32 Sensor",
      icon: <GlobeIcon />,
      status: "Offline",
      color: "red",
    },
  ];

  return (
    <Card size="2" variant="surface">
      <Flex direction="column" gap="3">
        <Text as="div" size="3" weight="bold">
          System Integrations
        </Text>
        <Separator size="4" />

        <Flex direction="column" gap="3">
          {integrations.map((integration, idx) => (
            <Flex key={idx} justify="between" align="center">
              <Flex align="center" gap="2">
                <Box style={{ color: `var(--${integration.color}-9)` }}>
                  {integration.icon}
                </Box>
                <Text size="2" weight="medium">
                  {integration.name}
                </Text>
              </Flex>
              {/* @ts-ignore - Radix UI badge color prop typing workaround */}
              <Badge color={integration.color} radius="full" variant="soft">
                {integration.status}
              </Badge>
            </Flex>
          ))}
        </Flex>
      </Flex>
    </Card>
  );
}
