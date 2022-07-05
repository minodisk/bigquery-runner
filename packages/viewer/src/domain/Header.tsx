import { Box, Flex, HStack, Spinner, Text } from "@chakra-ui/react";
import React from "react";
import { CFC } from "../types";

export const Header: CFC<{ loading?: string }> = ({
  loading,
  children,
  ...props
}) => (
  <Box position="sticky" height="36px" top={0}>
    <Flex
      position="fixed"
      height="36px"
      top={0}
      left={0}
      right={0}
      bgColor="var(--vscode-editorGroupHeader-tabsBackground);"
      borderBottomColor="var(--vscode-editorGroupHeader-tabsBorder)"
      borderBottomWidth={2}
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
