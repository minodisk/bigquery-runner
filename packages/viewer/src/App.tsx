import React, {
  ButtonHTMLAttributes,
  HTMLProps,
  PropsWithChildren,
  useEffect,
  useState,
} from "react";
import {
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
  const [data, setData] = useState<Rows | undefined>(
    /*payload ??*/ vscode?.getState()
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
    <Box>
      <Nav current={current} onChange={setCurrent} />
      <div>
        <TabContent name="results" current={current}>
          {loading ? (
            <HStack className="loading" p={2} gap={1}>
              <Spinner />
              <Text color="weak">{loading}</Text>
            </HStack>
          ) : null}
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
              <Pagination
                page={data.page}
                edge={data.edge}
                rowsInPage={data.rows.length}
                totalRows={data.numRows}
              />
            </VStack>
          ) : (
            <VStack>
              <table>
                <thead>
                  <Tr>
                    <Th>
                      <Skeleton />
                    </Th>
                    <Th>
                      <Skeleton />
                    </Th>
                    <Th>
                      <Skeleton />
                    </Th>
                    <Th>
                      <Skeleton />
                    </Th>
                    <Th>
                      <Skeleton />
                    </Th>
                  </Tr>
                </thead>
                <tbody>
                  {new Array(3).fill(null).map((_, i) => (
                    <Tr key={i}>
                      <Td>
                        <Skeleton />
                      </Td>
                      <Td>
                        <Skeleton />
                      </Td>
                      <Td>
                        <Skeleton />
                      </Td>
                      <Td>
                        <Skeleton />
                      </Td>
                      <Td>
                        <Skeleton />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
                <tfoot>
                  <Tr>
                    <Th colSpan={5}>
                      <Skeleton />
                    </Th>
                  </Tr>
                </tfoot>
              </table>
            </VStack>
          )}
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

const Nav: FC<{
  readonly current: string;
  readonly onChange: (current: string) => void;
}> = ({ current, onChange }) => (
  <div className="nav">
    <HStack className="tabs">
      <Tab name="results" current={current} onChange={onChange}>
        <Text align="center">Results</Text>
      </Tab>
      <Tab name="information" current={current} onChange={onChange}>
        Job Information
      </Tab>
      {/* <Tab
          name="formats"
          current={current}
          onChange={onChange}
        >
          Formats
        </Tab> */}
    </HStack>
  </div>
);

const Pagination: FC<{
  readonly page?: Page;
  readonly edge: Edge;
  readonly rowsInPage: number;
  readonly totalRows: string;
}> = ({ page, edge, rowsInPage, totalRows, ...props }) =>
  page?.maxResults === undefined ? null : (
    <div className="paginationWrapper">
      <Flex justify="between" className="pagination">
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
          <Text color="weak">{page.maxResults * page.current + 1}</Text>
          <Text color="weak">-</Text>
          <Text color="weak">
            {page.maxResults * page.current + rowsInPage}
          </Text>
          <Text color="weak">/</Text>
          <Text color="weak">{totalRows}</Text>
        </HStack>
      </Flex>
    </div>
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

type StackProps = BoxProps & {
  readonly direction?: "vertical" | "horizontal";
};
const Stack: XFC<StackProps> = ({ className, direction, ...props }) => (
  <Box
    className={cx("stack", { [`stack-${direction}`]: true }, className)}
    {...props}
  />
);

type VStackProps = Omit<StackProps, "direction">;
const VStack: XFC<VStackProps> = (props) => (
  <Stack direction="vertical" {...props} />
);

type HStackProps = Omit<StackProps, "direction">;
const HStack: XFC<HStackProps> = ({ ...props }) => (
  <Stack direction="horizontal" {...props} />
);

type FlexProps = StackProps & {
  readonly justify?: "start" | "end" | "center" | "between" | "around";
  readonly align?: "strech" | "start" | "end" | "center" | "baseline";
};
const Flex: XFC<FlexProps> = ({ className, justify, align, ...props }) => (
  <Stack
    className={cx(
      "flex",
      { [`justify-${justify}`]: !!justify, [`align-${align}`]: !!align },
      className
    )}
    {...props}
  />
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

const Text: XFC<{ color?: "weak"; align?: "center" }> = ({
  className,
  color,
  align,
  ...props
}) => (
  <span
    className={cx(
      "text",
      { weakColor: color === "weak", alignCenter: align === "center" },
      className
    )}
    {...props}
  />
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
//       <path d="m7.225 8 4.357 4.357-.618.62-4.667-4.67V7.69l4.667-4.667.618.62L7.225 8ZM4.418 3.024h.879v9.953h-.88z" />
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
//       <path d="M8.775 8 4.418 3.643l.618-.62 4.667 4.67v.617l-4.667 4.666-.618-.619L8.775 8Zm1.928-4.976h.879v9.953h-.88z" />
//     </svg>
//   </IconButton>
// );

const PrevButton: VFC<IconButtonProps> = (props) => (
  <IconButton {...props}>
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
      <path d="m6.285 8 4.357 4.357-.617.62-4.668-4.67V7.69l4.667-4.667.619.62L6.285 8Z" />
    </svg>
  </IconButton>
);

const NextButton: VFC<IconButtonProps> = (props) => (
  <IconButton {...props}>
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
      <path d="M9.714 8 5.357 3.643l.619-.62 4.667 4.67v.617l-4.668 4.666-.617-.619L9.713 8Z" />
    </svg>
  </IconButton>
);

const CopyButton: VFC<IconButtonProps> = (props) => (
  <IconButton {...props}>
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
      <span className="tab-border" />
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

const Spinner: FC = () => <div className="spinner" />;

const Skeleton: FC = () => <div className="skeleton" />;

export default App;
