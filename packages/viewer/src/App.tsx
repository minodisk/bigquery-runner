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

type Data = {
  source: "bigquery-runner";
  payload: Event;
};

function isData(data: any): data is Data {
  return data.source === "bigquery-runner";
}

type Event = Clear | Header | Row;

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

type Row = {
  event: "rows";
  payload: Array<{ [key: string]: any }>;
};

function isRow(e: Event): e is Row {
  return e.event === "rows";
}

function App() {
  const [columns, setColumns] = useState<Array<Column>>([]);
  const [data, setData] = useState<Array<object>>([]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    footerGroups,
    rows,
    prepareRow,
  } = useTable({
    columns,
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
      if (isRow(payload)) {
        setData((rows) => [...rows, ...payload.payload]);
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
          {headerGroups.map((headerGroup) => (
            <Tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column) => (
                <Th
                  textTransform="none"
                  color="var(--vscode-terminal-foreground)"
                  fontFamily="var(--vscode-editor-font-family)"
                  fontSize="var(--vscode-editor-font-size)"
                  borderBottomColor="var(--vscode-terminal-border)"
                  borderBottomWidth={2}
                  {...column.getHeaderProps()}
                >
                  {column.render("Header")}
                </Th>
              ))}
            </Tr>
          ))}
        </Thead>
        <Tbody {...getTableBodyProps()}>
          {rows.map((row) => {
            prepareRow(row);
            return (
              <Tr {...row.getRowProps()}>
                {row.cells.map((cell) => {
                  return (
                    <Td
                      color="var(--vscode-terminal-foreground)"
                      fontFamily="var(--vscode-editor-font-family)"
                      fontSize="var(--vscode-editor-font-size)"
                      fontWeight="var(--vscode-editor-font-weight)"
                      borderBottomColor="var(--vscode-terminal-border)"
                      {...cell.getCellProps()}
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
          {footerGroups.map((footerGroup) => (
            <Tr {...footerGroup.getHeaderGroupProps()}>
              {footerGroup.headers.map((column) => (
                <Th
                  textTransform="none"
                  color="var(--vscode-terminal-foreground)"
                  fontFamily="var(--vscode-editor-font-family)"
                  fontSize="var(--vscode-editor-font-size)"
                  borderTopColor="var(--vscode-terminal-border)"
                  borderTopWidth={2}
                  {...column.getHeaderProps()}
                >
                  {column.render("Header")}
                </Th>
              ))}
            </Tr>
          ))}
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
