import { CopyIcon } from "@chakra-ui/icons";
import {
  Box,
  Flex,
  IconButton,
  Text,
  TextProps,
  useToast,
  VStack,
} from "@chakra-ui/react";
import React, { PropsWithChildren } from "react";

export type VFC<P = {}> = (
  props: P & { className?: string }
) => JSX.Element | null;
export type FC<P = {}> = (props: PropsWithChildren<P>) => JSX.Element | null;
export type XFC<P = {}> = FC<P & { className?: string }>;

export const Header: FC = ({ ...props }) => (
  <Box position="sticky" top={0} height={38.5}>
    <Flex
      position="fixed"
      top={0}
      left={0}
      right={0}
      bgColor="var(--vscode-editorGroupHeader-tabsBackground);"
      borderBottomWidth="1px"
      borderBottomStyle="solid"
      borderBottomColor="var(--vscode-editorGroupHeader-tabsBorder)"
      justifyContent="space-between"
      {...props}
    />
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
      borderTopWidth="1px"
      borderTopStyle="solid"
      borderTopColor="var(--vscode-editorGroupHeader-tabsBorder)"
      justifyContent="space-between"
      {...props}
    />
  </Box>
);

// export const Tr: XFC<HTMLProps<HTMLTableRowElement>> = ({
//   className,
//   ...props
// }) => <tr className={cx("headerCell", className)} {...props} />;

// export const Th: XFC<HTMLProps<HTMLTableCellElement>> = ({
//   className,
//   ...props
// }) => <th className={cx("headerCell", className)} {...props} />;

// export const RowNumberTh: typeof Th = ({ className, ...props }) => (
//   <Th className={cx("rowNumber", className)} {...props} />
// );

// export const Td: XFC<HTMLProps<HTMLTableCellElement>> = ({
//   className,
//   ...props
// }) => <td className={cx("dataCell", className)} {...props} />;

// export const RowNumberTd: typeof Td = ({ className, ...props }) => (
//   <Td className={cx("rowNumber", className)} {...props} />
// );

// export type TextProps = {
//   color?: "weak";
//   align?: "center";
//   size?: 1 | 2 | 3;
// };
// export const Text: XFC<TextProps> = ({ className, color, align, ...props }) => (
//   <span
//     className={cx(
//       "text",
//       {
//         weakColor: color === "weak",
//         alignCenter: align === "center",
//       },
//       className
//     )}
//     {...props}
//   />
// );

// export type UITextProps = TextProps;
// export const UIText: XFC<UITextProps> = ({ className, ...props }) => (
//   <Text className={cx("ui", className)} {...props} />
// );

// export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
// export const Button: XFC<ButtonProps> = ({
//   className,
//   onMouseDown,
//   onMouseUp,
//   ...props
// }) => {
//   const [pressed, setPressed] = useState(false);
//   return (
//     <button
//       className={cx({ pressed }, "button", className)}
//       onMouseDown={(e) => {
//         setPressed(true);
//         if (onMouseDown) {
//           onMouseDown(e);
//         }
//       }}
//       onMouseUp={(e) => {
//         setPressed(false);
//         if (onMouseUp) {
//           onMouseUp(e);
//         }
//       }}
//       {...props}
//     />
//   );
// };

// export type IconButtonProps = ButtonProps;
// export const IconButton: XFC<IconButtonProps> = ({ className, ...props }) => (
//   <Button className={cx("iconButton", className)} {...props} />
// );

// const StartButton: VFC<IconButtonProps> = (props) => (
//   <IconButton {...props}>
//     <svg
//       width="16"
//       height="16"
//       xmlns="http://www.w3.org/2000/svg"
//       xmlSpace="preserve"
//       fillRule="evenodd"
//       clipRule="evenodd"
//       strokeLinejoin="round"
//       strokeMiterlimit="2"
//     >
//       <path d="M6 12.976H5V3.023h1zm1-4.592 4.593 4.592.707-.707L8.031 8 12.3 3.731l-.707-.708L7 7.616v.768Z" />
//     </svg>
//   </IconButton>
// );

// const EndButton: VFC<IconButtonProps> = (props) => (
//   <IconButton {...props}>
//     <svg
//       width="16"
//       height="16"
//       xmlns="http://www.w3.org/2000/svg"
//       xmlSpace="preserve"
//       fillRule="evenodd"
//       clipRule="evenodd"
//       strokeLinejoin="round"
//       strokeMiterlimit="2"
//     >
//       <path d="M10 3.024h1v9.953h-1zM9 7.616 4.407 3.024l-.707.707L7.969 8 3.7 12.269l.707.708L9 8.384v-.768Z" />
//     </svg>
//   </IconButton>
// );

// export const PrevButton: VFC<IconButtonProps> = (props) => (
//   <IconButton title="Previous" {...props}>
//     <svg
//       width="16"
//       height="16"
//       xmlns="http://www.w3.org/2000/svg"
//       xmlSpace="preserve"
//       fillRule="evenodd"
//       clipRule="evenodd"
//       strokeLinejoin="round"
//       strokeMiterlimit="2"
//     >
//       <path d="m5 8.384 4.593 4.592.707-.707L6.031 8 10.3 3.731l-.707-.708L5 7.616v.768Z" />
//     </svg>
//   </IconButton>
// );

// export const NextButton: VFC<IconButtonProps> = (props) => (
//   <IconButton title="Next" {...props}>
//     <svg
//       width="16"
//       height="16"
//       xmlns="http://www.w3.org/2000/svg"
//       xmlSpace="preserve"
//       fillRule="evenodd"
//       clipRule="evenodd"
//       strokeLinejoin="round"
//       strokeMiterlimit="2"
//     >
//       <path d="M11 7.616 6.407 3.024l-.707.707L9.969 8 5.7 12.269l.707.708L11 8.384v-.768Z" />
//     </svg>
//   </IconButton>
// );

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
        onClick={(e) => {
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

// export const Spinner: FC = () => (
//   <svg
//     width="16"
//     height="16"
//     xmlns="http://www.w3.org/2000/svg"
//     xmlSpace="preserve"
//     fillRule="evenodd"
//     clipRule="evenodd"
//     strokeLinejoin="round"
//     strokeMiterlimit="2"
//     fill="currentColor"
//     className="spinner"
//   >
//     <path d="M1.07 7A7.009 7.009 0 0 1 8 1.006 7.009 7.009 0 0 1 14.93 7h-1.006A6.005 6.005 0 0 0 8 1.957 6.005 6.005 0 0 0 2.076 7H1.07Z" />
//   </svg>
// );

export const Breakable: FC<TextProps> = (props) => (
  <Text
    css={{
      lineBreak: "anywhere",
    }}
    {...props}
  />
);

// export const Pre: FC<TextProps> = (props) => {
//   return <Text whiteSpace="pre" {...props} />;
// };
