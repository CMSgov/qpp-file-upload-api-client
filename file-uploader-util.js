import { axios } from 'axios';

/*
 * Function for validating a submission Object using the /submissions/validate
 * endpoint. Returns the validated submission if it was successful -- if there
 * was an error, we throw an error
 *
 * @param {Object} submission
 * @param {String} submissionFormat
 * @param {Object} baseOptions
 */
function validateSubmission(submission, submissionFormat, baseOptions) {
  const headers = Object.assign({}, baseOptions.headers);

  // We're going to receive JSON from the Submissions API with the submission object
  // in the response -- this allows us to convert between QPP XML and QPP JSON without
  // having to do any XML parsing in this module.
  if (submissionFormat === 'XML') {
    headers['Content-Type'] = 'application/xml';
  } else if (submissionFormat === 'JSON') {
    // This is already defined in the headers, but just making it explicit here
    headers['Content-Type'] = 'application/json';
  } else {
    // Returning a promise here with an Error thrown to be consistent with
    // other errors
    return new Promise((resolve, reject) => {
      throw new Error('Invalid format');
    });
  };

  const validateSubmissionOptions = Object.assign({}, baseOptions, {
    headers: headers,
    data: submission
  });

  return axios.post(baseOptions.url + '/submissions/validate', validateSubmissionOptions)
    .then((body) => {
      const validatedSubmission = JSON.parse(body).data.submission;

      if (!validatedSubmission.measurementSets || validatedSubmission.measurementSets.length === 0) {
        throw new Error('At least one measurementSet must be defined to use this functionality');
      };

      return validatedSubmission;
    });
};

/*
 * Function to retrieve a submission that matches the submission parameters
 * given in the submission of the uploaded file. This function does a
 * GET /submissions request with the taxpayerIdentificationNumber in the header
 * and any other optional query parameters in the URL (nationalProviderIdentifier
 * and entityId). However, this request could theoretically return more than one
 * submission because the entityType parameter could be different. The Submissions API
 * doesn't allow filtering on the entityType, so we manually filter for a matching
 * entityType here to find a single matching submission
 *
 * @param {Object} submission
 * @param {Object} baseOptions
 * @return {Object}
 */
function getExistingSubmission(submission, baseOptions) {
  const queryParams = {};

  if (submission.nationalProviderIdentifier) {
    queryParams.nationalProviderIdentifier = submission.nationalProviderIdentifier;
  };

  if (submission.entityId) {
    queryParams.entityId = submission.entityId;
  };

  // Make a string of URL-encoded query parameters
  const queryParamString = Object.keys(queryParams).map((key) => {
    return `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`;
  }).join('&');

  const getSubmissionsOptions = Object.assign({}, baseOptions, {
    headers: Object.assign({}, baseOptions.headers, {
      'qpp-taxpayer-identification-number': submission.taxpayerIdentificationNumber
    })
  });

  return axios.get(baseOptions.url + '/submissions?' + queryParamString, getSubmissionsOptions)
    .then((body) => {
      const jsonBody = JSON.parse(body);
      const existingSubmissions = jsonBody.data.submissions;

      // Look for a submission with the same entityType -- need to do this here because
      // we can't filter on entityType in our API call to GET /submissions
      const matchingExistingSubmissions = jsonBody.data.submissions.filter((existingSubmission) => {
        return existingSubmission.entityType = submission.entityType;
      });

      if (matchingExistingSubmissions.length > 1) {
        throw new Error('Could not determine which existing Submission matches request');
      };

      if (matchingExistingSubmissions.length === 0) {
        return;
      };

      return matchingExistingSubmissions[0];
    });
};

/*
 * Function for calling PUT /measurement-sets on the Submissions API. Expects
 * a 200 status code. request-promise will throw an error if the response has
 * a non-2xx status code
 *
 * @param {Object} measurementSet
 * @param {Object} baseOptions
 * @param {String} measurementSetId
 * @return {Object}
 */
function putMeasurementSet(measurementSet, baseOptions, measurementSetId) {
  const putMeasurementSetOptions = Object.assign({}, baseOptions, {
    data: JSON.stringify(measurementSet)
  });

  return axios.put(baseOptions.url + '/measurement-sets/' + measurementSetId, putMeasurementSetOptions)
    .then((body) => {
      // Assuming a 200 response here
      return JSON.parse(body).data.measurementSet;
    });
};

/*
 * Function for calling POST /measurement-sets on the Submissions API. Expects
 * a 201 status code. request-promise will throw an error if the response has
 * a non-2xx status code
 *
 * @param {Object} measurementSet
 * @param {Object} baseOptions
 * @return {Object}
 */
function postMeasurementSet(measurementSet, baseOptions) {
  const postMeasurementSetOptions = Object.assign({}, baseOptions, {
    data: JSON.stringify(measurementSet)
  });

  return axios.post(baseOptions.url + '/measurement-sets', postMeasurementSetOptions)
    .then((body) => {
      // Assuming a 201 response here
      return JSON.parse(body).data.measurementSet;
    });
};

/*
 * Function to submit measurementSets from file via POST or PUT. Given the
 * existing submission, we loop through the measurementSets we want to submit
 * and if there's already an existing measurementSet with the same submissionMethod
 * and category, we'll call PUT with the existing measurementSet's ID to replace
 * the measurementSet, and if there's not an existing measurementSet matching those
 * two parameters, we'll call POST to create a new measurementSet.
 *
 * @param {Object} existingSubmission
 * @param {Object} submission
 * @param {Object} baseOptions
 * @return {Array<Promise>}
 */
function submitMeasurementSets(existingSubmission, submission, baseOptions) {
  const promises = [];
  submission.measurementSets.forEach((measurementSet) => {
    let measurementSetToSubmit;
    let existingMeasurementSets = [];

    // If there's an existing submission, then the measurementSet to submit needs the
    // submissionId in it. If not, we put the submission object in the measurementSet
    if (existingSubmission) {
      measurementSetToSubmit = Object.assign({}, measurementSet, {submissionId: existingSubmission.id});
      existingMeasurementSets = existingSubmission.measurementSets;
    } else {
      measurementSetToSubmit = Object.assign({}, measurementSet, {submission: {
        programName: submission.programName,
        entityType: submission.entityType,
        entityId: submission.entityId || null,
        taxpayerIdentificationNumber: submission.taxpayerIdentificationNumber,
        nationalProviderIdentifier: submission.nationalProviderIdentifier || null,
        performanceYear: submission.performanceYear
      }});
    };

    // Look for existing measurementSets with the same category + submissionMethod
    const matchingMeasurementSets = existingMeasurementSets.filter((existingMeasurementSet) => {
      return existingMeasurementSet.submissionMethod === measurementSet.submissionMethod &&
        existingMeasurementSet.category === measurementSet.category;
    });
    if (matchingMeasurementSets.length > 0) {
      // Do a PUT
      const matchingMeasurementSetId = matchingMeasurementSets[0].id;
      promises.push(putMeasurementSet(measurementSetToSubmit, baseOptions, matchingMeasurementSetId));
    } else {
      // Do a POST
      promises.push(postMeasurementSet(measurementSetToSubmit, baseOptions));
    };
  });

  return promises;
};

module.exports = {
  validateSubmission,
  getExistingSubmission,
  putMeasurementSet,
  postMeasurementSet,
  submitMeasurementSets
};
