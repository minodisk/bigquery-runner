import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import {
  SuccessProcessingEvent,
  Data,
  StartProcessingEvent,
  RowsEvent,
  Table,
} from "types";
import metadata from "../../core/src/metadata.json";
import t from "../../core/src/table.json";
import App from "./App";

const table = t as Table;

describe("App", () => {
  describe("types", () => {
    it("should render null, boolean, number and string", async () => {
      render(<App />);
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: {
            event: "startProcessing",
          },
        } as Data<StartProcessingEvent>,
        "*"
      );
      window.postMessage(
        JSON.stringify({
          source: "bigquery-runner",
          payload: {
            event: "rows",
            payload: {
              header: ["a", "b", "d", "e"],
              rows: [
                {
                  rowNumber: "1",
                  rows: [
                    [
                      { id: "a", value: null },
                      { id: "b", value: true },
                      { id: "d", value: 123.45 },
                      { id: "e", value: "foo" },
                    ],
                  ],
                },
              ],
              metadata,
              table,
              page: {
                hasPrev: false,
                hasNext: false,
                rowNumberStart: "1",
                rowNumberEnd: "1",
                numRows: "123000",
              },
            },
          },
        } as Data<RowsEvent>),
        "*"
      );
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: {
            event: "successProcessing",
          },
        } as Data<SuccessProcessingEvent>,
        "*"
      );

      await waitFor(() => {
        expect(screen.getByText(/null/i)).toBeInTheDocument();
        expect(screen.getByText(/true/i)).toBeInTheDocument();
        expect(screen.getByText(/123\.45/i)).toBeInTheDocument();
        expect(screen.getByText(/foo/i)).toBeInTheDocument();
      });
    });

    it("should not render undefined", async () => {
      render(<App />);

      const rows: Data<RowsEvent> = {
        source: "bigquery-runner",
        payload: {
          event: "rows",
          payload: {
            header: ["a", "b", "c", "d", "e"],
            rows: [
              {
                rowNumber: "1",
                rows: [
                  [
                    { id: "a", value: 100 },
                    { id: "b", value: 200 },
                    { id: "c", value: undefined },
                    { id: "d", value: 300 },
                    { id: "e", value: 400 },
                  ],
                ],
              },
            ],
            // metadata,
            // table,
            page: {
              hasPrev: false,
              hasNext: false,
              rowNumberStart: "1",
              rowNumberEnd: "2",
              numRows: "123000",
            },
          },
        },
      };

      window.postMessage(JSON.stringify(rows), "*");

      await waitFor(() => {
        expect(() => screen.getByText(/undefined/i)).toThrow();
      });
    });
  });

  it("should render complex table", async () => {
    render(<App />);

    const rows: Data<RowsEvent> = {
      source: "bigquery-runner",
      payload: {
        event: "rows",
        payload: {
          header: [
            "order_id",
            "items.product_id",
            "items.quantity",
            "items.name",
            "items.price",
          ],
          rows: [
            {
              rowNumber: "0",
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: "0",
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: "0",
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: "0",
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: "0",
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: "0",
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: "1",
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
            {
              rowNumber: "1",
              rows: [
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
                [
                  { id: "order_id", value: 1 },
                  { id: "items.product_id", value: 1001 },
                  { id: "items.quantity", value: 4 },
                  { id: "items.name", value: "wallet" },
                  { id: "items.price", value: 30000 },
                ],
              ],
            },
          ],
          // metadata,
          // table,
          page: {
            hasPrev: false,
            hasNext: false,
            rowNumberStart: "1",
            rowNumberEnd: "2",
            numRows: "123000",
          },
        },
      },
    };

    window.postMessage(JSON.stringify(rows), "*");

    await waitFor(() => {
      const els = screen.getAllByText(/wallet/i);
      els.forEach((el) => expect(el).toBeInTheDocument());
    });
  });
});
