import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import React, { FC } from "react";
import { RoutinePayload } from "types";
import { Header } from "../domain/Header";
import { Job } from "../domain/Job";
import { Routine as RoutineTabContent } from "../domain/Routine";

export const Routine: FC<
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
          <RoutineTabContent routine={routine} />
        </TabPanel>
        <TabPanel>
          <Job metadata={metadata} />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};
