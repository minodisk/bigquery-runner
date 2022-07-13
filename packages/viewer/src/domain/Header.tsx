import { Box, Flex, HStack, Spinner } from "@chakra-ui/react";
import React from "react";
import type { CFC } from "../types";

export const Header: CFC<{ processing: boolean }> = ({
  processing,
  children,
  ...props
}) => {
  return (
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
        {processing ? (
          <HStack px={2}>
            <Spinner size="sm" />
          </HStack>
        ) : null}
      </Flex>
    </Box>
  );
};
