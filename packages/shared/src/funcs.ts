import type {
  Data,
  DownloadEvent,
  EndEvent,
  FailProcessingEvent,
  FocusedEvent,
  FocusOnTabEvent,
  JobReference,
  MetadataEvent,
  MoveTabFocusEvent,
  NextEvent,
  PrevEvent,
  PreviewEvent,
  RendererEvent,
  RoutineEvent,
  RoutineReference,
  RowsEvent,
  StartEvent,
  StartProcessingEvent,
  SuccessProcessingEvent,
  TableEvent,
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

export function isTableEvent(e: RendererEvent): e is TableEvent {
  return e.event === "table";
}

export function isRoutineEvent(e: RendererEvent): e is RoutineEvent {
  return e.event === "routine";
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
