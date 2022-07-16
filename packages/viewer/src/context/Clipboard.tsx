import React, { createContext, useContext } from "react";
import type { CFC } from "../types";

export type Clipboard = Readonly<{
  writeText(data: string): Promise<void>;
}>;

const ClipboardContext = createContext({
  writeText: (data: string) => navigator.clipboard.writeText(data),
});

export const ClipboardProvider: CFC<Partial<Clipboard>> = ({
  writeText = (data) => navigator.clipboard.writeText(data),
  children,
}) => {
  return (
    <ClipboardContext.Provider
      value={{
        writeText,
      }}
    >
      {children}
    </ClipboardContext.Provider>
  );
};

export const useClipboard = () => {
  return useContext(ClipboardContext);
};
