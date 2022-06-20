import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import React, { FC } from "react";
import { RoutinePayload } from "types";
import { JobInformation } from "./JobInformation";
import { RoutineInformation } from "./RoutineInformation";
import { Header } from "./ui";

const Routine: FC<
  Readonly<{
    focused: boolean;
    loading?: string;
    routinePayload: RoutinePayload;
  }>
> = ({ focused, loading, routinePayload: { metadata, routine } }) => {
  return (
    <Tabs>
      <Header loading={loading}>
        <TabList>
          <Tab>Routine</Tab>
          <Tab>Job</Tab>
        </TabList>
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
  );
};

export default Routine;
