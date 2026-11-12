export type SbmUploadMeasurementSetResult = {
  measurementSet: {
    suppressed: boolean;
    id: string;
    createdAt: string;
    updatedAt: string;
    submissionId: string;
    category: string;
    submissionMethod: string;
    submitterId: string;
    submitterType: string;
    programName: string;
    practiceId: string;
    practiceDetails?: {
      nationalProviderIdentifiers: string[];
      taxpayerIdentificationNumbers: string[];
    } | null;
    cehrtId: string;
    source?: string | null;
    performanceStart: string;
    performanceEnd: string;
    measurements: {
      id: string;
      measurementSetId: string;
      measureId: string;
      value: unknown;
    }[];
  };
  warnings: string[];
};

export type SbmUploadMeasurementSetResultWarning = string;

export type SbmUploadMeasurementSetResultError =
  | {
      type: string;
      message: string;
      error?: string;
      timestamp?: string;
      path?: string;
      statusCode?: number;
      details?: {
        message?: string;
        path?: string;
        submissionId?: string;
      }[];
    }
  | Error;

/**
 * @deprecated Use `fileUploaderWithOptions` instead.
 */
export function fileUploader(
  submissionBody: string | object,
  submissionFormat: 'JSON' | 'XML',
  requestHeaders: Record<string, string>,
  baseSubmissionURL: string,
  callback: (errors: any, createdMeasurementSets: any, warnings?: any) => void
): Promise<void>;

export function fileUploaderWithOptions(options: {
  submissionBody: string | object;
  submissionFormat: 'JSON' | 'XML';
  requestHeaders?: Record<string, string>;
  baseSubmissionURL: string;
  sessionId?: string;
  fileId?: string;
}): Promise<{
  errors: SbmUploadMeasurementSetResultError[];
  createdMeasurementSets: SbmUploadMeasurementSetResult[];
  warnings?: SbmUploadMeasurementSetResultWarning[] | null;
}>;
