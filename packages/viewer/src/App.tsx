import React, {
  ButtonHTMLAttributes,
  HTMLProps,
  PropsWithChildren,
  useEffect,
  useState,
} from "react";
import {
  isFocusedEvent,
  isCloseEvent,
  isData,
  isOpenEvent,
  isRowsEvent,
  Page,
  Rows,
  ViewerEvent,
} from "core/src/types";
import cx from "classnames";
import "./App.css";
import { Edge } from "extension/src/runJobManager";
// import * as payload from "../../misc/mock/payload.json";

type VFC<P = {}> = (props: P & { className?: string }) => JSX.Element | null;
type FC<P = {}> = (props: PropsWithChildren<P>) => JSX.Element | null;
type XFC<P = {}> = FC<P & { className?: string }>;

const w = window as unknown as {
  acquireVsCodeApi?: () => {
    getState(): Rows;
    setState(rows: Rows): void;
    postMessage(e: ViewerEvent): void;
  };
};
const vscode = w.acquireVsCodeApi ? w.acquireVsCodeApi() : undefined;

const App: FC = () => {
  const [focused, setFocused] = useState(false);
  const [data, setData] = useState<Rows | undefined>(
    /*payload ?? */ vscode?.getState()
  );
  const [loading, setLoading] = useState<string | undefined>("Initializing");
  const [isPending, startTransition] = (
    React as unknown as {
      useTransition: (props: {
        timeoutMs: number;
      }) => [
        isPending: boolean,
        startTransition: (callback: () => unknown) => void
      ];
    }
  ).useTransition({
    timeoutMs: 5000,
  });
  const [current, setCurrent] = useState<string>("results");

  useEffect(() => {
    window.addEventListener("message", (e: MessageEvent) => {
      // When postMessage from a test, this value becomes a JSON string, so parse it.
      const data =
        typeof e.data === "string" && e.data ? JSON.parse(e.data) : e.data;
      if (!isData(data)) {
        return;
      }
      const { payload } = data;
      if (isFocusedEvent(payload)) {
        setFocused(payload.payload.focused);
        return;
      }
      if (isOpenEvent(payload)) {
        setLoading("Fetching");
        return;
      }
      if (isRowsEvent(payload)) {
        setLoading(undefined);
        startTransition(() => {
          setData(payload.payload);
          vscode?.setState(payload.payload);
        });
        return;
      }
      if (isCloseEvent(payload)) {
        setLoading(undefined);
        return;
      }
      throw new Error(`undefined data payload '${payload}'`);
    });
  }, [startTransition]);

  useEffect(() => {
    if (isPending) {
      setLoading("Rendering");
    } else {
      setLoading(undefined);
    }
  }, [isPending]);

  return (
    <Box className={cx({ focused })}>
      <Header current={current} loading={loading} onChange={setCurrent} />
      <div>
        <TabContent name="results" current={current}>
          {data ? (
            <VStack>
              <table>
                <thead>
                  <Tr>
                    <RowNumberTh>Row</RowNumberTh>
                    {data.header.map((head) => (
                      <Th key={head}>{head}</Th>
                    ))}
                  </Tr>
                </thead>
                <tbody>
                  {data.rows.map(({ rowNumber, rows }, i) => {
                    const lastRow = i === data.rows.length - 1;
                    return rows.map((row, j) => (
                      <Tr
                        key={j}
                        className={cx({
                          lastOfRowNumber: lastRow && j === 0,
                        })}
                      >
                        {j === 0 ? (
                          <RowNumberTd rowSpan={rows.length}>
                            {rowNumber}
                          </RowNumberTd>
                        ) : null}
                        {row.map((cell) => {
                          return (
                            <Td key={cell.id}>
                              {cell.value === undefined
                                ? null
                                : `${cell.value}`}
                            </Td>
                          );
                        })}
                      </Tr>
                    ));
                  })}
                </tbody>
              </table>
              <Footer
                page={data.page}
                edge={data.edge}
                rowsInPage={data.rows.length}
                totalRows={data.numRows}
              />
            </VStack>
          ) : null}
        </TabContent>
        <TabContent name="information" current={current}>
          {data ? (
            <table>
              <tbody>
                <Tr>
                  <RowNumberTd>Destination Table</RowNumberTd>
                  <Td>
                    <HStack gap={2}>
                      <Text className="breakable">{data.destinationTable}</Text>
                      <Flex align="center">
                        <CopyButton
                          disabled={!data.destinationTable}
                          onClick={() => {
                            if (data.destinationTable) {
                              navigator.clipboard.writeText(
                                data.destinationTable
                              );
                            }
                          }}
                        />
                      </Flex>
                    </HStack>
                  </Td>
                </Tr>
              </tbody>
            </table>
          ) : null}
        </TabContent>
        <TabContent name="formats" current={current}>
          formats
        </TabContent>
      </div>
    </Box>
  );
};

const Header: FC<{
  readonly current: string;
  readonly loading?: string;
  readonly onChange: (current: string) => void;
}> = ({ current, loading, onChange }) => (
  <Box className="header">
    <Flex justify="between" className="nav">
      <HStack>
        <Tab name="results" current={current} onChange={onChange}>
          <UIText>Results</UIText>
        </Tab>
        <Tab name="information" current={current} onChange={onChange}>
          <UIText>Job Information</UIText>
        </Tab>
        {/* <Tab
          name="formats"
          current={current}
          onChange={onChange}
        >
          Formats
        </Tab> */}
      </HStack>
      {loading ? (
        <HStack reverse align="center" gap={1} px={2}>
          <Spinner />
          <UIText color="weak">{loading}</UIText>
        </HStack>
      ) : null}
    </Flex>
  </Box>
);

const Footer: FC<{
  readonly page?: Page;
  readonly edge: Edge;
  readonly rowsInPage: number;
  readonly totalRows: string;
}> = ({ page, edge, rowsInPage, totalRows, ...props }) =>
  page?.maxResults === undefined ? null : (
    <Box className="footer">
      <Flex justify="between" className="pagination" px={2}>
        <HStack gap={2} {...props}>
          {/* <StartButton onClick={() => vscode?.postMessage({ event: "start" })} /> */}
          <PrevButton
            disabled={!edge.hasPrev}
            onClick={() => vscode?.postMessage({ event: "prev" })}
          />
          <NextButton
            disabled={!edge.hasNext}
            onClick={() => vscode?.postMessage({ event: "next" })}
          />
          {/* <EndButton onClick={() => vscode?.postMessage({ event: "end" })} /> */}
        </HStack>
        <HStack gap={2} {...props}>
          <UIText color="weak">{page.maxResults * page.current + 1}</UIText>
          <UIText color="weak">-</UIText>
          <UIText color="weak">
            {page.maxResults * page.current + rowsInPage}
          </UIText>
          <UIText color="weak">of</UIText>
          <UIText color="weak">{totalRows}</UIText>
        </HStack>
      </Flex>
    </Box>
  );

type BoxProps = {
  readonly p?: 1 | 2 | 3;
  readonly px?: 1 | 2 | 3;
  readonly py?: 1 | 2 | 3;
  readonly gap?: 1 | 2 | 3;
};
const Box: XFC<BoxProps> = ({ className, p, px, py, gap, ...props }) => (
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

type FlexProps = BoxProps & {
  readonly direction?: "horizontal" | "vertical";
  readonly reverse?: boolean;
  readonly justify?: "start" | "end" | "center" | "between" | "around";
  readonly align?: "strech" | "start" | "end" | "center" | "baseline";
};
const Flex: XFC<FlexProps> = ({
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

type StackProps = Omit<FlexProps, "justify">;
const Stack: XFC<StackProps> = ({ className, ...props }) => (
  <Flex className={cx("stack", className)} {...props} />
);

type VStackProps = Omit<StackProps, "direction">;
const VStack: XFC<VStackProps> = (props) => (
  <Stack direction="vertical" {...props} />
);

type HStackProps = Omit<StackProps, "direction">;
const HStack: XFC<HStackProps> = ({ ...props }) => (
  <Stack direction="horizontal" {...props} />
);

const Tr: XFC<HTMLProps<HTMLTableRowElement>> = ({ className, ...props }) => (
  <tr className={cx("headerCell", className)} {...props} />
);

const Th: XFC<HTMLProps<HTMLTableCellElement>> = ({ className, ...props }) => (
  <th className={cx("headerCell", className)} {...props} />
);

const RowNumberTh: typeof Th = ({ className, ...props }) => (
  <Th className={cx("rowNumber", className)} {...props} />
);

const Td: XFC<HTMLProps<HTMLTableCellElement>> = ({ className, ...props }) => (
  <td className={cx("dataCell", className)} {...props} />
);

const RowNumberTd: typeof Td = ({ className, ...props }) => (
  <Td className={cx("rowNumber", className)} {...props} />
);

type TextProps = {
  color?: "weak";
  align?: "center";
  size?: 1 | 2 | 3;
};
const Text: XFC<TextProps> = ({ className, color, align, ...props }) => (
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

type UITextProps = TextProps;
const UIText: XFC<UITextProps> = ({ className, ...props }) => (
  <Text className={cx("ui", className)} {...props} />
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
const Button: XFC<ButtonProps> = ({
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

type IconButtonProps = ButtonProps;
const IconButton: XFC<IconButtonProps> = ({ className, ...props }) => (
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

const PrevButton: VFC<IconButtonProps> = (props) => (
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

const NextButton: VFC<IconButtonProps> = (props) => (
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

const CopyButton: VFC<IconButtonProps> = (props) => (
  <IconButton title="Copy" {...props}>
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
);

const Spinner: FC = () => (
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

const Tab: XFC<
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

const TabContent: XFC<{
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

// const Skeleton: FC = () => <div className="skeleton" />;

export default App;
