"use client";

import { useState, useEffect } from "react";
import { Card, Flex, Text, Box, TextField, Table, Badge, Button } from "@radix-ui/themes";
import { MagnifyingGlassIcon, ReloadIcon } from "@radix-ui/react-icons";

interface MemoryDoc {
  id: string;
  filePath?: string;
  content: string;
  metadata: {
    category?: string;
    source?: string;
    [key: string]: unknown;
  };
  lastUpdatedAt?: string;
  occurredAt?: string;
}

export function MemoryExplorer() {
  const [documents, setDocuments] = useState<MemoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error("Failed to fetch indexed documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.filePath && doc.filePath.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      categoryFilter === "all" ||
      doc.metadata?.category?.toLowerCase() === categoryFilter.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case "static":
        return "blue";
      case "dynamic":
        return "orange";
      case "conversational":
        return "green";
      case "system":
        return "purple";
      default:
        return "gray";
    }
  };

  return (
    <Card size="3" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Flex direction="column" gap="4" style={{ height: "100%" }}>
        {/* Title and Refresh */}
        <Flex justify="between" align="center">
          <Box>
            <Text size="5" weight="bold">
              Vector Memory Explorer
            </Text>
            <Text size="2" color="gray" as="div">
              Browse, search, and inspect the semantic knowledge chunks currently stored in your vector store database.
            </Text>
          </Box>
          <Button variant="soft" onClick={fetchDocuments} disabled={loading}>
            <ReloadIcon className={loading ? "spin" : ""} /> Refresh
          </Button>
        </Flex>

        {/* Filters */}
        <Flex gap="3" align="center" wrap="wrap">
          <Box style={{ flexGrow: 1, minWidth: "200px" }}>
            <TextField.Root
              placeholder="Search by content or source path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            >
              <TextField.Slot>
                <MagnifyingGlassIcon height="16" width="16" />
              </TextField.Slot>
            </TextField.Root>
          </Box>
          <Flex gap="2">
            {["all", "static", "dynamic", "conversational", "system"].map((cat) => (
              <Button
                key={cat}
                size="1"
                variant={categoryFilter === cat ? "solid" : "soft"}
                color={cat === "all" ? "gray" : getCategoryColor(cat)}
                onClick={() => setCategoryFilter(cat)}
                style={{ textTransform: "capitalize" }}
              >
                {cat}
              </Button>
            ))}
          </Flex>
        </Flex>

        {/* Document Table */}
        <Box style={{ flexGrow: 1, overflowY: "auto", maxHeight: "60vh" }}>
          {loading ? (
            <Flex justify="center" align="center" style={{ height: "200px" }}>
              <Text size="3" color="gray">
                Loading vector store index documents...
              </Text>
            </Flex>
          ) : filteredDocs.length === 0 ? (
            <Flex justify="center" align="center" style={{ height: "200px", border: "1px dashed var(--gray-5)", borderRadius: "8px" }}>
              <Text size="3" color="gray">
                No matching documents found in vector store memory.
              </Text>
            </Flex>
          ) : (
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell style={{ width: "120px" }}>Category</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Content Chunk</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: "200px" }}>Source Location</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: "150px" }}>Occurred At</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                {filteredDocs.map((doc) => (
                  <Table.Row key={doc.id}>
                    <Table.RowHeaderCell>
                      <Badge color={getCategoryColor(doc.metadata?.category)}>
                        {doc.metadata?.category || "Unknown"}
                      </Badge>
                    </Table.RowHeaderCell>
                    <Table.Cell>
                      <Text
                        size="2"
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          cursor: "pointer",
                        }}
                        title={doc.content}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          if (target.style.display === "block") {
                            target.style.display = "-webkit-box";
                          } else {
                            target.style.display = "block";
                          }
                        }}
                      >
                        {doc.content}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="1" color="gray" style={{ wordBreak: "break-all" }}>
                        {doc.filePath || "direct embedding"}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="1" color="gray">
                        {doc.occurredAt ? new Date(doc.occurredAt).toLocaleString() : "N/A"}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>
        <Flex justify="end">
          <Text size="1" color="gray">
            Showing {filteredDocs.length} of {documents.length} memory records.
          </Text>
        </Flex>
      </Flex>
    </Card>
  );
}
