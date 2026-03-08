"use client";

import { SegmentedControl, Flex, Text } from "@radix-ui/themes";
import { PersonIcon, MagicWandIcon, BackpackIcon } from "@radix-ui/react-icons";

export type Mode = "default" | "recruiter" | "social";

interface ContextSelectorProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export function ContextSelector({ mode, setMode }: ContextSelectorProps) {
  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="bold" color="gray">
        Context Router
      </Text>
      <SegmentedControl.Root
        value={mode}
        onValueChange={(val) => setMode(val as Mode)}
        size="2"
      >
        <SegmentedControl.Item value="default">
          <Flex align="center" gap="2">
            <MagicWandIcon /> Auto
          </Flex>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="recruiter">
          <Flex align="center" gap="2">
            <BackpackIcon /> Recruiter
          </Flex>
        </SegmentedControl.Item>
        <SegmentedControl.Item value="social">
          <Flex align="center" gap="2">
            <PersonIcon /> Friend
          </Flex>
        </SegmentedControl.Item>
      </SegmentedControl.Root>
      <Text size="1" color="gray">
        {mode === "default" &&
          "Automatically routes intent based on your prompt."}
        {mode === "recruiter" &&
          "Strictly professional mode tied to resume & projects."}
        {mode === "social" && "Casual mode tied to Strava, Instagram & travel."}
      </Text>
    </Flex>
  );
}
