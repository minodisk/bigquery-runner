import cx from "classnames";
import React, {
  ButtonHTMLAttributes,
  HTMLProps,
  PropsWithChildren,
  useEffect,
  useState,
} from "react";

export type VFC<P = {}> = (
  props: P & { className?: string }
) => JSX.Element | null;
export type FC<P = {}> = (props: PropsWithChildren<P>) => JSX.Element | null;
export type XFC<P = {}> = FC<P & { className?: string }>;

export type BoxProps = {
  readonly p?: 1 | 2 | 3;
  readonly px?: 1 | 2 | 3;
  readonly py?: 1 | 2 | 3;
  readonly gap?: 1 | 2 | 3;
};
export const Box: XFC<BoxProps> = ({ className, p, px, py, gap, ...props }) => (
  <div
    className={cx(
      "box",
      {
        [`px-${p ?? px}`]: !!p || !!px,
        [`py-${p ?? py}`]: !!p || !!py,
        [`gap-${gap}`]: !!gap,
      },
      className
    )}
    {...props}
  />
);

export type FlexProps = BoxProps & {
  readonly direction?: "horizontal" | "vertical";
  readonly reverse?: boolean;
  readonly justify?: "start" | "end" | "center" | "between" | "around";
  readonly align?: "strech" | "start" | "end" | "center" | "baseline";
};
export const Flex: XFC<FlexProps> = ({
  className,
  direction = "horizontal",
  reverse = false,
  justify = "start",
  align = "strech",
  ...props
}) => (
  <Box
    className={cx(
      "flex",
      `direction-${direction}`,
      { reverse },
      `justify-${justify}`,
      `align-${align}`,
      className
    )}
    {...props}
  />
);

export type StackProps = Omit<FlexProps, "justify">;
export const Stack: XFC<StackProps> = ({ className, ...props }) => (
  <Flex className={cx("stack", className)} {...props} />
);

export type VStackProps = Omit<StackProps, "direction">;
export const VStack: XFC<VStackProps> = (props) => (
  <Stack direction="vertical" {...props} />
);

export type HStackProps = Omit<StackProps, "direction">;
export const HStack: XFC<HStackProps> = ({ ...props }) => (
  <Stack direction="horizontal" {...props} />
);

export const Tr: XFC<HTMLProps<HTMLTableRowElement>> = ({
  className,
  ...props
}) => <tr className={cx("headerCell", className)} {...props} />;

export const Th: XFC<HTMLProps<HTMLTableCellElement>> = ({
  className,
  ...props
}) => <th className={cx("headerCell", className)} {...props} />;

export const RowNumberTh: typeof Th = ({ className, ...props }) => (
  <Th className={cx("rowNumber", className)} {...props} />
);

export const Td: XFC<HTMLProps<HTMLTableCellElement>> = ({
  className,
  ...props
}) => <td className={cx("dataCell", className)} {...props} />;

export const RowNumberTd: typeof Td = ({ className, ...props }) => (
  <Td className={cx("rowNumber", className)} {...props} />
);

export type TextProps = {
  color?: "weak";
  align?: "center";
  size?: 1 | 2 | 3;
};
export const Text: XFC<TextProps> = ({ className, color, align, ...props }) => (
  <span
    className={cx(
      "text",
      {
        weakColor: color === "weak",
        alignCenter: align === "center",
      },
      className
    )}
    {...props}
  />
);

export type UITextProps = TextProps;
export const UIText: XFC<UITextProps> = ({ className, ...props }) => (
  <Text className={cx("ui", className)} {...props} />
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
export const Button: XFC<ButtonProps> = ({
  className,
  onMouseDown,
  onMouseUp,
  ...props
}) => {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      className={cx({ pressed }, "button", className)}
      onMouseDown={(e) => {
        setPressed(true);
        if (onMouseDown) {
          onMouseDown(e);
        }
      }}
      onMouseUp={(e) => {
        setPressed(false);
        if (onMouseUp) {
          onMouseUp(e);
        }
      }}
      {...props}
    />
  );
};

export type IconButtonProps = ButtonProps;
export const IconButton: XFC<IconButtonProps> = ({ className, ...props }) => (
  <Button className={cx("iconButton", className)} {...props} />
);

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

export const PrevButton: VFC<IconButtonProps> = (props) => (
  <IconButton title="Previous" {...props}>
    <svg
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      xmlSpace="preserve"
      fillRule="evenodd"
      clipRule="evenodd"
      strokeLinejoin="round"
      strokeMiterlimit="2"
    >
      <path d="m5 8.384 4.593 4.592.707-.707L6.031 8 10.3 3.731l-.707-.708L5 7.616v.768Z" />
    </svg>
  </IconButton>
);

export const NextButton: VFC<IconButtonProps> = (props) => (
  <IconButton title="Next" {...props}>
    <svg
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg"
      xmlSpace="preserve"
      fillRule="evenodd"
      clipRule="evenodd"
      strokeLinejoin="round"
      strokeMiterlimit="2"
    >
      <path d="M11 7.616 6.407 3.024l-.707.707L9.969 8 5.7 12.269l.707.708L11 8.384v-.768Z" />
    </svg>
  </IconButton>
);

export const CopyButton: VFC<IconButtonProps & { text?: string }> = ({
  text,
  onClick,
  ...props
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      setTimeout(() => {
        setCopied(false);
      }, 1000);
    }
  }, [copied]);

  return (
    <VStack align="center">
      <IconButton
        title="Copy"
        disabled={!text}
        onClick={(e) => {
          if (text) {
            navigator.clipboard.writeText(text);
            setCopied(true);
          }
          if (onClick) {
            onClick(e);
          }
        }}
        {...props}
      >
        <svg
          width="16"
          height="16"
          xmlns="http://www.w3.org/2000/svg"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="m4 4 1-1h5.414L14 6.586V14l-1 1H5l-1-1V4zm9 3-3-3H5v10h8V7z"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3 1 2 2v10l1 1V2h6.414l-1-1H3z"
          />
        </svg>
      </IconButton>
      {copied ? (
        <Box className="labelWrapper">
          <Box className="labelContainer">
            <UIText className="label">Copied</UIText>
          </Box>
        </Box>
      ) : null}
    </VStack>
  );
};

export const Spinner: FC = () => (
  <svg
    width="16"
    height="16"
    xmlns="http://www.w3.org/2000/svg"
    xmlSpace="preserve"
    fillRule="evenodd"
    clipRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit="2"
    fill="currentColor"
    className="spinner"
  >
    <path d="M1.07 7A7.009 7.009 0 0 1 8 1.006 7.009 7.009 0 0 1 14.93 7h-1.006A6.005 6.005 0 0 0 8 1.957 6.005 6.005 0 0 0 2.076 7H1.07Z" />
  </svg>
);

export const Tab: XFC<
  Omit<ButtonProps, "onChange"> & {
    name: string;
    current: string;
    onChange: (name: string) => unknown;
  }
> = ({ children, className, name, current = false, onChange, ...props }) => (
  <Button
    className={cx({ current: name === current }, "tab", className)}
    disabled={name === current}
    onClick={() => {
      onChange(name);
    }}
    {...props}
  >
    <VStack>
      {children}
      <Box className="tabBorder" />
    </VStack>
  </Button>
);

export const TabContent: XFC<{
  name: string;
  current: string;
}> = ({ name, current, ...props }) => {
  return (
    <div
      className={cx("tabContent", {
        show: name === current,
      })}
      {...props}
    />
  );
};

// export const Skeleton: FC = () => <div className="skeleton" />;
