import { Box, Flex } from "@chakra-ui/react";
import React from "react";
import type { CFC } from "../types";

export const Footer: CFC = ({ children, ...props }) => (
  <Box position="sticky" height="25px" bottom={0}>
    <Flex
      position="fixed"
      height="25px"
      bottom={0}
      left={0}
      right={0}
      bgColor="var(--vscode-editorGroupHeader-tabsBackground);"
      borderTopWidth={2}
      borderTopColor="var(--vscode-editorGroupHeader-tabsBorder)"
      justifyContent="space-between"
      {...props}
    >
      {children}
    </Flex>
  </Box>
);
