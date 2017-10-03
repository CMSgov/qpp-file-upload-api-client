const fileUploaderUtil = require('./file-uploader-util');

/*
 * Main function to be exported from this file. Calls individual functions to
 * parse the submission body given, validate it with the POST /submissions/validate
 * endpoint, look for an existing submission matching the file's submission's parameters,
 * and then POST or PUT measurementSets from the file.
 *
 * @param {String} submissionBody
 * @param {String} submissionFormat ('JSON' or 'XML')
 * @param {String} JWT
 * @param {String} baseSubmissionURL
 * @param {Function} callback
 *
 * @return {Promise}
 */
const fileUploader = function(submissionBody, submissionFormat, JWT, baseSubmissionURL, callback) {
  let submission;
  let existingSubmission
  const errs = [];
  const createdMeasurementSets = [];

  const baseOptions = {
    url: baseSubmissionURL,
    headers: {
      'Authorization': 'Bearer ' + JWT,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  return fileUploaderUtil.validateSubmission(submissionBody, submissionFormat, baseOptions)
    .then((validSubmission) => {
      submission = validSubmission;
      return fileUploaderUtil.getExistingSubmission(submission, baseOptions);
    }).then((existingSubmissionReturned) => {
      existingSubmission = existingSubmissionReturned;
      let firstMeasurementSetPromise;

      // If there is no existing submission, we want to do one POST /measurement-sets call
      // first and let it fully finish so it can create the new Submission and not compete
      // with other POST /measurement-sets calls to create the submission, which can cause
      // errors
      if (!existingSubmission) {
        const firstMeasurementSet = Object.assign({}, submission.measurementSets.pop(), {submission: {
          programName: submission.programName,
          entityType: submission.entityType,
          entityId: submission.entityId || null,
          taxpayerIdentificationNumber: submission.taxpayerIdentificationNumber,
          nationalProviderIdentifier: submission.nationalProviderIdentifier || null,
          performanceYear: submission.performanceYear
        }});
        firstMeasurementSetPromise = fileUploaderUtil.postMeasurementSet(firstMeasurementSet, baseOptions);
      };

      return firstMeasurementSetPromise;
    }).then((firstMeasurementSetOutput) => {
      // If we did fire off the first POST /measurement-sets call and it worked (because
      // no error was thrown), then store the output here
      if (firstMeasurementSetOutput) {
        createdMeasurementSets.push(firstMeasurementSetOutput);
      };

      // Submit all remaining measurementSets
      const postAndPutPromises = fileUploaderUtil.submitMeasurementSets(existingSubmission, submission, baseOptions);

      // Transform rejected promises into Errors so they are caught and don't short-circuit
      // the others
      const caughtPromises = postAndPutPromises.map(promise => promise.catch(Error));
      return Promise.all(caughtPromises);
    }).then((postAndPutOutputs) => {
      // Aggregate the errors and created measurementSets
      postAndPutOutputs.forEach((postOrPutOutput) => {
        if (postOrPutOutput instanceof Error) {
          errs.push(postOrPutOutput);
        } else {
          createdMeasurementSets.push(postOrPutOutput);
        };
      });

      let errString;
      if (errs) {
        errString = errs.join('; ');
      }

      // Call the callback with the aggregated error string and list of measurementSets created
      callback(errString, createdMeasurementSets);
    }).catch((err) => {
      // Call the callback with the aggregated error string and an empty list (no measurementSets created)
      callback(err, []);
    });
};

module.exports = fileUploader;
