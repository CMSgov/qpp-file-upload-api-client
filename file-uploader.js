import { fileUploaderUtil } from './file-uploader-util';

/**
 * @deprecated Use fileUploaderWithOptions instead.
 */
export function fileUploader(
  submissionBody,
  submissionFormat,
  requestHeaders,
  baseSubmissionURL,
  callback
) {
  return fileUploaderWithOptions({
    submissionBody,
    submissionFormat,
    requestHeaders,
    baseSubmissionURL,
  })
    .then((result) => {
      callback(result.errors, result.createdMeasurementSets, result.warnings);
    })
    .catch((err) => {
      callback([err], []);
    });
}

/**
 * Main function to be exported from this file. Calls individual functions to
 * parse the submission body given, validate it with the POST /public/validate-submission
 * endpoint, look for an existing submission matching the file's submission's parameters,
 * and then POST or PUT measurementSets from the file.
 *
 * Note: Error Format
 * ```json
 * {
 * "error": {
 *   "type": "ValidationError",
 *   "message": "invalid submission object",
 *   "details": [
 *     {
 *       "message": "field 'submissionMethod' in Submission.measurementSets[0] is invalid: cmsWebInterface is not allowed via file upload",
 *       "path": "$.measurementSets[0].submissionMethod"
 *     },
 *     {
 *       "message": "field 'submissionMethod' in Submission.measurementSets[1] is invalid: cmsWebInterface is not allowed via file upload",
 *       "path": "$.measurementSets[1].submissionMethod"
 *     }
 *   ]
 * }
 * ```
 * @param {Object} options The options for the uploader
 * @param {unknown} options.submissionBody
 * @param {String} options.submissionFormat ('JSON' or 'XML')
 * @param {Object} options.requestHeaders
 * @param {String} options.baseSubmissionURL
 * @param {String} options.sessionId The session ID that the file should be associated with
 * @param {String} options.fileId The ID of the file being uploaded
 */
export async function fileUploaderWithOptions(options) {
  const {
    submissionBody,
    submissionFormat,
    requestHeaders,
    baseSubmissionURL,
    sessionId,
    fileId,
  } = options;
  let validatedSubmission;
  let existingSubmission;
  const errs = [];
  const createdMeasurementSets = [];

  const baseOptions = {
    url: baseSubmissionURL,
    headers: Object.assign(
      {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      requestHeaders
    ),
  };

  const fileIdentifiers = sessionId && fileId ? { sessionId, fileId } : null;

  return fileUploaderUtil
    .validateSubmission(submissionBody, submissionFormat, baseOptions)
    .then((_validSubmission) => {
      // QPPSF-5596, part of the validation logic for NonProportion measures for PY 2019, is to add a new field during validation,
      // to prevent additional fields being added, we are going to send the original submission object
      // to the api since the validation adds some validation properties
      validatedSubmission =
        typeof submissionBody === 'string'
          ? JSON.parse(submissionBody)
          : submissionBody;

      // if we have file identifiers, attach them to each measurement set
      if (fileIdentifiers && validatedSubmission.measurementSets) {
        validatedSubmission.measurementSets.forEach((set) => {
          Object.assign(set, fileIdentifiers);
        });
      }
      return fileUploaderUtil.getExistingSubmission(
        validatedSubmission,
        baseOptions
      );
    })
    .then((existingSubmissionReturned) => {
      existingSubmission = existingSubmissionReturned;
      let firstMeasurementSetPromise;

      // If there is no existing submission, we want to do one POST /measurement-sets call
      // first and let it fully finish so it can create the new Submission and not compete
      // with other POST /measurement-sets calls to create the submission, which can cause
      // errors
      if (!existingSubmission) {
        const firstMeasurementSet = Object.assign(
          {},
          validatedSubmission.measurementSets.pop(),
          {
            submission: {
              programName: validatedSubmission.programName,
              entityType: validatedSubmission.entityType,
              entityId: validatedSubmission.entityId || null,
              taxpayerIdentificationNumber:
                validatedSubmission.taxpayerIdentificationNumber || null,
              nationalProviderIdentifier:
                validatedSubmission.nationalProviderIdentifier || null,
              performanceYear: validatedSubmission.performanceYear,
            },
          }
        );
        firstMeasurementSetPromise = fileUploaderUtil.postMeasurementSet(
          firstMeasurementSet,
          baseOptions
        );
      }

      return firstMeasurementSetPromise;
    })
    .then((firstMeasurementSetOutput) => {
      // If we did fire off the first POST /measurement-sets call and it worked (because
      // no error was thrown), then store the output here
      if (firstMeasurementSetOutput) {
        createdMeasurementSets.push(firstMeasurementSetOutput);
      }

      // Submit all remaining measurementSets
      const postAndPutPromises = fileUploaderUtil.submitMeasurementSets(
        existingSubmission,
        validatedSubmission,
        baseOptions,
        requestHeaders
      );

      // Transform rejected promises into Errors so they are caught and don't short-circuit
      // the others
      const caughtPromises = postAndPutPromises.map((promise) =>
        promise.catch((err) => {
          return {
            error: err,
          };
        })
      );

      return Promise.all(caughtPromises);
    })
    .then((postAndPutOutputs) => {
      let warnings = [];
      // Aggregate the errors and created measurementSets
      postAndPutOutputs.forEach((postOrPutOutput) => {
        if (postOrPutOutput && postOrPutOutput.error) {
          errs.push(postOrPutOutput.error);
        } else if (postOrPutOutput && postOrPutOutput.warnings) {
          warnings.push(postOrPutOutput.warnings);
        } else {
          createdMeasurementSets.push(postOrPutOutput);
        }
      });
      if (warnings && warnings.length > 0) {
        warnings = warnings.reduce((a, b) => {
          return a !== b ? a : null;
        });
      } else {
        warnings = null;
      }

      // Call the callback with the aggregated error string and list of measurementSets created
      return {
        errors: errs,
        createdMeasurementSets: createdMeasurementSets,
        warnings: warnings,
      };
    })
    .catch((err) => {
      throw err;
    });
}
