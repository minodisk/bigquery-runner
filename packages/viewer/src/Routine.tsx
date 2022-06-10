import React, { FC, useState } from "react";
import { RoutinePayload } from "core/src/types";
import cx from "classnames";
import { JobInformation } from "./JobInformation";
import { Box, Flex, HStack, Spinner, Tab, TabContent, UIText } from "./ui";
import { RoutineInformation } from "./RoutineInformation";
// import * as payload from "../../misc/mock/payload.json";

const Routine: FC<
  Readonly<{
    focused: boolean;
    loading?: string;
    routinePayload: RoutinePayload;
  }>
> = ({ focused, loading, routinePayload: { metadata, routine } }) => {
  const [current, setCurrent] = useState("jobInformation");

  return (
    <Box className={cx({ focused })}>
      <Header current={current} onChange={setCurrent} loading={loading} />
      <div>
        <TabContent name="jobInformation" current={current}>
          <JobInformation metadata={metadata} />
        </TabContent>
        <TabContent name="routineInformation" current={current}>
          <RoutineInformation routine={routine} />
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
        <Tab name="jobInformation" current={current} onChange={onChange}>
          <UIText>Job</UIText>
        </Tab>
        <Tab name="routineInformation" current={current} onChange={onChange}>
          Routine
        </Tab>
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

export default Routine;
