import {
  Stack,
  Table,
  Tbody,
  Td,
  Tfoot,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { Column, useTable } from "react-table";
import { Row } from "bigquery/src/flatten";

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
  payload: Array<Row>;
};

function isRows(e: Event): e is Rows {
  return e.event === "rows";
}

function App() {
  const [columns, setColumns] = useState<Array<Column>>([]);
  const [data, setData] = useState<Array<Row>>([]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    footerGroups,
    rows,
    prepareRow,
  } = useTable({
    columns: columns as any,
    data,
  });

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
        setData([]);
        return;
      }
      if (isHeader(payload)) {
        console.log("->", payload.payload);
        const columns = payload.payload.map((accessor) => ({
          accessor: (d: any) => d[accessor],
          Header: accessor,
          key: accessor,
        }));
        console.log("=>", columns);
        setColumns(columns);
        return;
      }
      if (isRows(payload)) {
        setData((data) => [...data, ...payload.payload]);
        return;
      }
      throw new Error(`undefined data payload '${payload}'`);
    });
  }, []);

  console.log(columns, data);

  return (
    <Stack m="3" display="inline-block">
      <Table size="sm" {...getTableProps()}>
        <Thead>
          {headerGroups.map((headerGroup) => {
            const { key, ...props } = headerGroup.getHeaderGroupProps();
            return (
              <Tr key={key} {...props}>
                {headerGroup.headers.map((column) => {
                  const { key, ...props } = column.getHeaderProps();
                  return (
                    <Th
                      key={key}
                      textTransform="none"
                      color="var(--vscode-terminal-foreground)"
                      fontFamily="var(--vscode-editor-font-family)"
                      fontSize="var(--vscode-editor-font-size)"
                      borderBottomColor="var(--vscode-terminal-border)"
                      borderBottomWidth={2}
                      {...props}
                    >
                      {column.render("Header")}
                    </Th>
                  );
                })}
              </Tr>
            );
          })}
        </Thead>
        <Tbody {...getTableBodyProps()}>
          {rows.map((row) => {
            prepareRow(row);
            const { key, ...props } = row.getRowProps();
            return (
              <Tr key={key} {...props}>
                {row.cells.map((cell) => {
                  const { key, ...props } = cell.getCellProps();
                  return (
                    <Td
                      key={key}
                      color="var(--vscode-terminal-foreground)"
                      fontFamily="var(--vscode-editor-font-family)"
                      fontSize="var(--vscode-editor-font-size)"
                      fontWeight="var(--vscode-editor-font-weight)"
                      borderBottomColor="var(--vscode-terminal-border)"
                      {...props}
                    >
                      {cell.render("Cell")}
                    </Td>
                  );
                })}
              </Tr>
            );
          })}
        </Tbody>
        <Tfoot>
          {footerGroups.map((footerGroup) => {
            const { key, ...props } = footerGroup.getHeaderGroupProps();
            return (
              <Tr key={key} {...props}>
                {footerGroup.headers.map((column) => {
                  const { key, ...props } = column.getHeaderProps();
                  return (
                    <Th
                      key={key}
                      textTransform="none"
                      color="var(--vscode-terminal-foreground)"
                      fontFamily="var(--vscode-editor-font-family)"
                      fontSize="var(--vscode-editor-font-size)"
                      borderTopColor="var(--vscode-terminal-border)"
                      borderTopWidth={2}
                      {...props}
                    >
                      {column.render("Header")}
                    </Th>
                  );
                })}
              </Tr>
            );
          })}
        </Tfoot>
      </Table>
    </Stack>
  );
}

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
//         payload: [
//           {
//             order_id: 1,
//             "items.product_id": 1001,
//             "items.quantity": 4,
//             "items.name": "wallet",
//             "items.price": 30000,
//           },
//           {
//             "items.product_id": 1003,
//             "items.quantity": 1,
//             "items.name": "bag",
//             "items.price": 50000,
//           },
//           {
//             order_id: 2,
//             "items.product_id": 1002,
//             "items.quantity": 2,
//             "items.name": "watch",
//             "items.price": 10000,
//           },
//           {
//             "items.product_id": 1003,
//             "items.quantity": 4,
//             "items.name": "bag",
//             "items.price": 50000,
//           },
//         ],
//       },
//     },
//   ];

//   for (const event of events) {
//     await sleep(10);
//     console.log(event);
//     window.postMessage(event);
//   }
// })();

// async function sleep(ms: number): Promise<void> {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

export default App;
