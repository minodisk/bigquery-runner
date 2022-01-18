import {
  Box,
  Stack,
  Table,
  TableCellProps,
  TableColumnHeaderProps,
  Tbody,
  Td as OrigTd,
  Text,
  Tfoot,
  Th as OrigTh,
  Thead,
  Tr,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { NumberedRows, Page } from "core";

type Data = {
  source: "bigquery-runner";
  payload: Event;
};

function isData(data: any): data is Data {
  return data.source === "bigquery-runner";
}

type Event = Clear | Header | Rows;

type Clear = {
  event: "clear";
  payload: undefined;
};

function isClear(e: Event): e is Clear {
  return e.event === "clear";
}

type Header = {
  event: "header";
  payload: Array<string>;
};

function isHeader(e: Event): e is Header {
  return e.event === "header";
}

type Rows = {
  event: "rows";
  payload: {
    rows: Array<NumberedRows>;
    page?: Page;
    numRows: string;
  };
};

function isRows(e: Event): e is Rows {
  return e.event === "rows";
}

function App() {
  const [columns, setColumns] = useState<Array<string>>([]);
  const [numberedRows, setNumberedRows] = useState<Array<NumberedRows>>([]);
  const [page, setPage] = useState<Page | undefined>();
  const [numRows, setNumRows] = useState<string>("");

  // const {
  //   getTableProps,
  //   getTableBodyProps,
  //   headerGroups,
  //   footerGroups,
  //   rows,
  //   prepareRow,
  // } = useTable({
  //   columns: columns as any,
  //   data,
  // });

  useEffect(() => {
    window.addEventListener("message", (e: MessageEvent) => {
      if (!isData(e.data)) {
        return;
      }
      const {
        data: { payload },
      } = e;
      if (isClear(payload)) {
        setColumns([]);
        setNumberedRows([]);
        setPage(undefined);
        setNumRows("");
        return;
      }
      if (isHeader(payload)) {
        // const columns = payload.payload.map((accessor) => ({
        //   accessor: (d: any) => d[accessor],
        //   Header: accessor,
        //   key: accessor,
        // }));
        setColumns(payload.payload);
        return;
      }
      if (isRows(payload)) {
        // setRows((data) => [...data, ...payload.payload]);
        setNumberedRows(payload.payload.rows);
        setPage(payload.payload.page);
        setNumRows(payload.payload.numRows);
        return;
      }
      throw new Error(`undefined data payload '${payload}'`);
    });
  }, []);

  return (
    <Stack m="3" display="inline-block">
      <Table size="sm">
        <Thead>
          <Tr>
            <Th color="var(--vscode-descriptionForeground)">row</Th>
            {columns.map((column) => (
              <Th key={column}>{column}</Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {numberedRows.map(({ rowNumber, rows }) =>
            rows.map((row, i) => (
              <Tr key={i}>
                {i === 0 ? (
                  <Td
                    rowSpan={rows.length}
                    verticalAlign="top"
                    color="var(--vscode-descriptionForeground)"
                  >
                    {rowNumber}
                  </Td>
                ) : null}
                {row.map((cell) => (
                  <Td key={cell.id}>{cell.value}</Td>
                ))}
              </Tr>
            ))
          )}
        </Tbody>
        <Tfoot>
          <Tr>
            <Th color="var(--vscode-descriptionForeground)">row</Th>
            {columns.map((column) => (
              <Th key={column}>{column}</Th>
            ))}
          </Tr>
        </Tfoot>
      </Table>
      {page ? (
        <Box ps={4}>
          <Text color="var(--vscode-descriptionForeground)">
            {page.rowsPerPage * page.current + 1} -{" "}
            {page.rowsPerPage * page.current + numberedRows.length} / {numRows}
          </Text>
        </Box>
      ) : null}
    </Stack>
  );
}

const Th = (props: TableColumnHeaderProps) => (
  <OrigTh
    textTransform="none"
    color="var(--vscode-terminal-foreground)"
    fontFamily="var(--vscode-editor-font-family)"
    fontSize="var(--vscode-editor-font-size)"
    borderTopColor="var(--vscode-terminal-border)"
    borderBottomColor="var(--vscode-terminal-border)"
    {...props}
  />
);

const Td = (props: TableCellProps) => (
  <OrigTd
    color="var(--vscode-terminal-foreground)"
    fontFamily="var(--vscode-editor-font-family)"
    fontSize="var(--vscode-editor-font-size)"
    fontWeight="var(--vscode-editor-font-weight)"
    borderBottomColor="var(--vscode-terminal-border)"
    {...props}
  />
);

// (async () => {
//   const events = [
//     {
//       source: "bigquery-runner",
//       payload: { event: "clear" },
//     },
//     {
//       source: "bigquery-runner",
//       payload: {
//         event: "header",
//         payload: [
//           "order_id",
//           "items.product_id",
//           "items.quantity",
//           "items.name",
//           "items.price",
//         ],
//       },
//     },
//     {
//       source: "bigquery-runner",
//       payload: {
//         event: "rows",
//         payload: {
//           rows: [
//             [
//               { id: "order_id", value: 1 },
//               { id: "items.product_id", value: 1001 },
//               { id: "items.quantity", value: 4 },
//               { id: "items.name", value: "wallet" },
//               { id: "items.price", value: 30000 },
//             ],
//             // [undefined, 1003, 1, "bag", 50000],
//             // [2, 1002, 2, "watch", 10000],
//             // [undefined, 1003, 4, "bag", 50000],
//           ],
//           page: { rowsPerPage: 100, current: 2 },
//           numRows: "123000",
//         },
//       },
//     },
//   ];

//   for (const event of events) {
//     await sleep(10);
//     window.postMessage(event);
//   }
// })();

// async function sleep(ms: number): Promise<void> {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

export default App;
