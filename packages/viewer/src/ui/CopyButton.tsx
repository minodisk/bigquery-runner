import { CopyIcon } from "@chakra-ui/icons";
import { IconButton, useToast, VStack } from "@chakra-ui/react";
import React from "react";
import { CFC } from "../types";

export const CopyButton: CFC<{ text?: string }> = ({ text, ...props }) => {
  const toast = useToast();

  return (
    <VStack align="center">
      <IconButton
        aria-label="Copy"
        icon={<CopyIcon />}
        size="xs"
        variant="ghost"
        disabled={!text}
        onClick={() => {
          if (!text) {
            return;
          }
          navigator.clipboard.writeText(text);
          toast({
            title: "Copied",
            status: "success",
            duration: 1000,
          });
        }}
        {...props}
      />
    </VStack>
  );
};
