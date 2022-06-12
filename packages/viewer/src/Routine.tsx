import React, { FC } from "react";
import { RoutinePayload } from "core/src/types";
import cx from "classnames";
import { JobInformation } from "./JobInformation";
import { RoutineInformation } from "./RoutineInformation";
import {
  Box,
  HStack,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { Header } from "./ui";
// import * as payload from "../../misc/mock/payload.json";

const Routine: FC<
  Readonly<{
    focused: boolean;
    loading?: string;
    routinePayload: RoutinePayload;
  }>
> = ({ focused, loading, routinePayload: { metadata, routine } }) => {
  return (
    <Box className={cx({ focused })}>
      <Tabs>
        <Header>
          <TabList>
            <Tab>Routine</Tab>
            <Tab>Job</Tab>
          </TabList>
          {loading ? (
            <HStack gap={1} px={2}>
              <Text>{loading}</Text>
              <Spinner size="sm" />
            </HStack>
          ) : null}
        </Header>
        <TabPanels>
          <TabPanel>
            <RoutineInformation routine={routine} />
          </TabPanel>
          <TabPanel>
            <JobInformation metadata={metadata} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Routine;
