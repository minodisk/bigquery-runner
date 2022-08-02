import type {
  ChildDdlRoutineQuery,
  ChildDdlTableQuery,
  ChildDmlQuery,
  ChildQuery,
  Data,
  DownloadEvent,
  EndEvent,
  FailProcessingEvent,
  FocusedEvent,
  FocusOnTabEvent,
  JobHasChildrenStatistics,
  JobReference,
  JobStandaloneStatistics,
  JobStatistics,
  MetadataEvent,
  MoveTabFocusEvent,
  NextEvent,
  PrevEvent,
  PreviewEvent,
  RendererEvent,
  RoutinesEvent,
  RoutineReference,
  RowsEvent,
  StartEvent,
  StartProcessingEvent,
  SuccessProcessingEvent,
  TablesEvent,
  TableReference,
  ViewerEvent,
} from "./types";

export const getJobName = ({ projectId, location, jobId }: JobReference) =>
  `${projectId}:${location}.${jobId}`;

export const getTableName = ({
  projectId,
  datasetId,
  tableId,
}: TableReference): string => `${projectId}.${datasetId}.${tableId}`;

export const getRoutineName = ({
  projectId,
  datasetId,
  routineId,
}: RoutineReference): string => `${projectId}.${datasetId}.${routineId}`;

export const isStandaloneStatistics = (
  statistics: JobStatistics
): statistics is JobStandaloneStatistics => {
  return !("numChildJobs" in statistics);
};
export const isJobHasChildrenStatistics = (
  statistics: JobStatistics
): statistics is JobHasChildrenStatistics => {
  return "numChildJobs" in statistics;
};

export const isChildDmlQuery = (query: ChildQuery): query is ChildDmlQuery => {
  return "dmlStats" in query;
};
export const isChildDdlTableQuery = (
  query: ChildQuery
): query is ChildDdlTableQuery => {
  return "ddlTargetTable" in query;
};
export const isChildDdlRoutineQuery = (
  query: ChildQuery
): query is ChildDdlRoutineQuery => {
  return "ddlTargetRoutine" in query;
};

export function isData(data: { source?: string }): data is Data<RendererEvent> {
  return data.source === "bigquery-runner";
}

export function isFocusedEvent(e: RendererEvent): e is FocusedEvent {
  return e.event === "focused";
}

export function isStartProcessingEvent(
  e: RendererEvent
): e is StartProcessingEvent {
  return e.event === "startProcessing";
}

export function isMetadataEvent(e: RendererEvent): e is MetadataEvent {
  return e.event === "metadata";
}

export function isTablesEvent(e: RendererEvent): e is TablesEvent {
  return e.event === "tables";
}

export function isRoutinesEvent(e: RendererEvent): e is RoutinesEvent {
  return e.event === "routines";
}

export function isRowsEvent(e: RendererEvent): e is RowsEvent {
  return e.event === "rows";
}

export function isSuccessLoadingEvent(
  e: RendererEvent
): e is SuccessProcessingEvent {
  return e.event === "successProcessing";
}

export function isFailProcessingEvent(
  e: RendererEvent
): e is FailProcessingEvent {
  return e.event === "failProcessing";
}

export function isMoveTabFocusEvent(e: RendererEvent): e is MoveTabFocusEvent {
  return e.event === "moveTabFocus";
}

export function isFocusOnTabEvent(e: RendererEvent): e is FocusOnTabEvent {
  return e.event === "focusOnTab";
}

export function isLoadedEvent(e: ViewerEvent): e is StartEvent {
  return e.event === "loaded";
}

export function isStartEvent(e: ViewerEvent): e is StartEvent {
  return e.event === "start";
}

export function isEndEvent(e: ViewerEvent): e is EndEvent {
  return e.event === "end";
}

export function isPrevEvent(e: ViewerEvent): e is PrevEvent {
  return e.event === "prev";
}

export function isNextEvent(e: ViewerEvent): e is NextEvent {
  return e.event === "next";
}

export function isDownloadEvent(e: ViewerEvent): e is DownloadEvent {
  return e.event === "download";
}

export function isPreviewEvent(e: ViewerEvent): e is PreviewEvent {
  return e.event === "preview";
}

export const commas = (num: bigint | string): string => {
  const text = num.toString();
  const len = text.length;
  let result = "";
  for (let i = 0; i < len; i++) {
    const char = text[len - 1 - i];
    if (!char) {
      break;
    }
    if (i === 0 || i % 3 !== 0) {
      result = `${char}${result}`;
    } else {
      result = `${char},${result}`;
    }
  }
  return result;
};
