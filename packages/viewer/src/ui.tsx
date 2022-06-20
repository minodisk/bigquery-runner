import { CopyIcon } from "@chakra-ui/icons";
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Spinner,
  Text,
  type TextProps,
  useToast,
  VStack,
} from "@chakra-ui/react";
import React, { PropsWithChildren } from "react";

export type VFC<P = {}> = (
  props: P & { className?: string }
) => JSX.Element | null;
export type FC<P = {}> = (props: PropsWithChildren<P>) => JSX.Element | null;
export type XFC<P = {}> = FC<P & { className?: string }>;

export const Header: FC<{ loading?: string }> = ({
  loading,
  children,
  ...props
}) => (
  <Box
    position="sticky"
    top={0}
    height="36px"
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

export const Footer: FC = ({ ...props }) => (
  <Box position="sticky" bottom={0} height={25}>
    <Flex
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      bgColor="var(--vscode-editorGroupHeader-tabsBackground);"
      borderTopWidth={2}
      borderTopColor="var(--vscode-editorGroupHeader-tabsBorder)"
      justifyContent="space-between"
      {...props}
    />
  </Box>
);

export const CopyButton: VFC<{ text?: string }> = ({ text, ...props }) => {
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

export const Breakable: FC<TextProps> = (props) => (
  <Text
    css={{
      lineBreak: "anywhere",
    }}
    {...props}
  />
);
