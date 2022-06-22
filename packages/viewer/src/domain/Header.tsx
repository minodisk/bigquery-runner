import { Box, Flex, HStack, Spinner, Text } from "@chakra-ui/react";
import React from "react";
import { CFC } from "../types";

export const Header: CFC<{ loading?: string }> = ({
  loading,
  children,
  ...props
}) => (
  <Box
    position="sticky"
    height="36px"
    top={0}
    bgColor="var(--vscode-editorGroupHeader-tabsBackground);"
    css={{
      "::before": {
        content: "''",
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        display: "block",
        borderBottomColor: "var(--vscode-editorGroupHeader-tabsBorder)",
        borderBottomWidth: 2,
      },
    }}
  >
    <Flex
      position="fixed"
      height="36px"
      top={0}
      left={0}
      right={0}
      justifyContent="space-between"
      {...props}
    >
      {children}
      {loading ? (
        <HStack px={2}>
          <Text>{loading}</Text>
          <Spinner size="sm" />
        </HStack>
      ) : null}
    </Flex>
  </Box>
);
