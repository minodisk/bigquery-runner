import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  describe("types", () => {
    it("should render null, boolean, number and string", async () => {
      render(<App />);
      window.postMessage(
        JSON.stringify({
          source: "bigquery-runner",
          payload: {
            event: "rows",
            payload: {
              page: { rowsPerPage: 100, current: 2 },
              numRows: "123000",
              header: ["a", "b", "c", "d", "e"],
              rows: [
                {
                  rowNumber: 0,
                  rows: [
                    [
                      { id: "a", value: null },
                      { id: "b", value: true },
                      { id: "c", value: false },
                      { id: "d", value: 123.45 },
                      { id: "e", value: "foo" },
                    ],
                  ],
                },
              ],
            },
          },
        }),
        "*"
      );

      await waitFor(() => {
        expect(screen.getByText(/null/i)).toBeInTheDocument();
        expect(screen.getByText(/true/i)).toBeInTheDocument();
        expect(screen.getByText(/false/i)).toBeInTheDocument();
        expect(screen.getByText(/123\.45/i)).toBeInTheDocument();
        expect(screen.getByText(/foo/i)).toBeInTheDocument();
      });
    });
  });

  it("should render complex table", async () => {
    render(<App />);
    window.postMessage(
      JSON.stringify({
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
                rowNumber: 0,
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
                rowNumber: 0,
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
                rowNumber: 0,
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
                rowNumber: 0,
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
                rowNumber: 0,
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
                rowNumber: 0,
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
                rowNumber: 1,
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
                rowNumber: 1,
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
            page: { rowsPerPage: 100, current: 2 },
            numRows: "123000",
          },
        },
      }),
      "*"
    );

    await waitFor(() => {
      const els = screen.getAllByText(/wallet/i);
      els.forEach((el) => expect(el).toBeInTheDocument());
    });
  });
});
