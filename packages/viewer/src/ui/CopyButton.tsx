import { CopyIcon } from "@chakra-ui/icons";
import { IconButton, useToast, VStack } from "@chakra-ui/react";
import React, { useCallback } from "react";
import { useClipboard } from "../context/Clipboard";
import type { CFC } from "../types";

export const CopyButton: CFC<{
  text: string;
}> = ({ text, ...props }) => {
  const toast = useToast();
  const { writeText } = useClipboard();

  const copy = useCallback(async () => {
    if (!text) {
      return;
    }
    await writeText(text);
    toast({
      title: "Copied",
      status: "success",
      position: "bottom-right",
      duration: 1000,
    });
  }, [text, toast, writeText]);

  return (
    <VStack align="center">
      <IconButton
        aria-label="Copy"
        icon={<CopyIcon />}
        size="xs"
        variant="ghost"
        disabled={!text}
        onClick={copy}
        {...props}
      />
    </VStack>
  );
};
