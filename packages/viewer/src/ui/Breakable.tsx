import { Text, type TextProps } from "@chakra-ui/react";
import React from "react";
import { CFC } from "../types";

export const Breakable: CFC<TextProps> = (props) => (
  <Text
    css={{
      lineBreak: "anywhere",
    }}
    {...props}
  />
);
