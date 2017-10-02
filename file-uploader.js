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
  let measurementSetsToCreate;
  const errs = [];
  const createdMeasurementSets = [];

  const baseOptions = {
    url: baseSubmissionURL,
    headers: {
      'Authorization': 'Bearer ' + JWT,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    resolveWithFullResponse: true
  };

  return fileUploaderUtil.validateSubmission(submissionBody, submissionFormat, baseOptions)
    .then((validSubmission) => {
      submission = Object.assign({}, validSubmission, {measurementSets: []});
      measurementSetsToCreate = validSubmission.measurementSets;

      if (!measurementSetsToCreate || measurementSetsToCreate.length === 0) {
        throw new Error('At least one measurementSet must be defined to use this functionality');
      };
      return fileUploaderUtil.getExistingSubmission(submission, baseOptions);
    }).then((existingSubmissionReturned) => {
      existingSubmission = existingSubmissionReturned;
      let firstMeasurementSetPromise;

      // If there is no existing submission, we want to do one POST /measurement-sets call
      // first and let it fully finish so it can create the new Submission and not compete
      // with other POST /measurement-sets calls to create the submission, which can cause
      // errors
      //
      if (!existingSubmission) {
        const firstMeasurementSet = Object.assign({}, measurementSetsToCreate.pop(), {submission: {
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
      // If we did fire off the first POST /measurement-sets call and it resulted in an
      // error, throw it here before trying the others
      if (firstMeasurementSetOutput) {
        if (firstMeasurementSetOutput[0]) {
          throw new Error('Could not create first measurementSet: ' + JSON.stringify(firstMeasurementSetOutput[0]));
        };

        if (firstMeasurementSetOutput[1]) {
          createdMeasurementSets.push(firstMeasurementSetOutput[1]);
        };
      };

      // Submit all remaining measurementSets
      const postAndPutPromises = fileUploaderUtil.submitMeasurementSets(existingSubmission, submission, measurementSetsToCreate, baseOptions);
      return Promise.all(postAndPutPromises);
    }).then((postAndPutOutputs) => {
      // Aggregate the errors and created measurementSets
      postAndPutOutputs.forEach((postOrPutOutput) => {
        if (postOrPutOutput[0]) {
          errs.push(postOrPutOutput[0]);
        };

        if (postOrPutOutput[1]) {
          createdMeasurementSets.push(postOrPutOutput[1]);
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
