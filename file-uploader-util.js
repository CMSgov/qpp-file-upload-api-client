import axios from 'axios';


/*
 * Function for validating a submission Object using the /public/validate-submission
 * endpoint. Returns the validated submission if it was successful -- if there
 * was an error, we throw an error
 *
 * @param {Object} submission
 * @param {String} submissionFormat
 * @param {Object} baseOptions
 */
export function validateSubmission(submission, submissionFormat, baseOptions) {
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
    return Promise.reject(createErrorResponse('ValidationError', 'Invalid file type'));
  }

  return axios.post(baseOptions.url + '/public/validate-submission', submission, {
    headers: headers
  }).then((body) => {
    const validatedSubmission = body.data.data.submission;

    // The submission must have measurement sets
    if (!validatedSubmission.measurementSets || validatedSubmission.measurementSets.length === 0) {
      let message = 'At least one measurementSet must be defined to use this functionality';
      return Promise.reject(createErrorResponse('ValidationError', message,
        createErrorDetails('Submission', ['measurementSets', null, message])
      ));
    }

    // cmsWebInterface is not an allowed submission method via file upload
    let errorDetails = [];
    validatedSubmission.measurementSets.forEach((ms, i) => {
      if (['registry', 'electronicHealthRecord'].indexOf(ms.submissionMethod) === -1) {
        errorDetails.push([
          'submissionMethod',
          `measurementSets[${i}]`,
          `'${ms.submissionMethod}' submission method is not allowed via file upload. registry and electronicHealthRecord are the only allowed submission methods.`
        ]);
      }
    });

    if (errorDetails.length) {
      return Promise.reject(createErrorResponse('ValidationError',
        'Measurement set contains a disallowed submission method',
        createErrorDetails('Submission', ...errorDetails)));
    }

    return validatedSubmission;
  }).catch(err => {
    return Promise.reject((err && err.response && err.response.data && err.response.data.error) || err);
  });
}

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
export function getExistingSubmission(submission, baseOptions) {
  const queryParams = {};

  if (submission.nationalProviderIdentifier) {
    queryParams.nationalProviderIdentifier = submission.nationalProviderIdentifier;
  }

  if (submission.entityId) {
    queryParams.entityId = submission.entityId;
  }

  if (submission.performanceYear) {
    queryParams.performanceYear = submission.performanceYear;
  }

  if (submission.entityType) {
    queryParams.entityType = submission.entityType;
  }

  // Make a string of URL-encoded query parameters
  const queryParamString = Object.keys(queryParams).map((key) => {
    return `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`;
  }).join('&');

  const headers = Object.assign({}, baseOptions.headers);
  
  if (submission.taxpayerIdentificationNumber) {
    headers['qpp-taxpayer-identification-number'] = submission.taxpayerIdentificationNumber;
  }

  return axios.get(baseOptions.url + '/submissions?' + queryParamString, {
    headers: headers
  }).then((body) => {
    const jsonBody = body.data;
    const totalItems = jsonBody.data.totalItems;
    const submissions = jsonBody.data.submissions;

    if (totalItems > 1) {
      return Promise.reject(
        createErrorResponse('ValidationError', 'Could not determine which existing Submission matches request')
      );
    }

    if (totalItems === 0) {
      return;
    }

    return submissions[0];
  }).catch(err => {
    return Promise.reject((err && err.response && err.response.data && err.response.data.error) || err);
  });
}

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
export function putMeasurementSet(measurementSet, baseOptions, measurementSetId) {
  return axios.put(baseOptions.url + '/measurement-sets/' + measurementSetId, JSON.stringify(measurementSet), {
    headers:baseOptions.headers
  }).then((body) => {
    // Assuming a 200 response here
    return body.data.data.measurementSet;
  }).catch(err => {
    return Promise.reject((err && err.response && err.response.data && err.response.data.error) || err);
  });
}

/*
 * Function for calling POST /measurement-sets on the Submissions API. Expects
 * a 201 status code. request-promise will throw an error if the response has
 * a non-2xx status code
 *
 * @param {Object} measurementSet
 * @param {Object} baseOptions
 * @return {Object}
 */
export function postMeasurementSet(measurementSet, baseOptions) {
  return axios.post(baseOptions.url + '/measurement-sets', JSON.stringify(measurementSet), {
    headers: baseOptions.headers
  }).then((body) => {
    // Assuming a 201 response here
    return body.data.data.measurementSet;
  }).catch(err => {
    return Promise.reject((err && err.response && err.response.data && err.response.data.error) || err);
  });
}

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
export function submitMeasurementSets(existingSubmission, submission, baseOptions, requestHeaders) {
  const orgId = requestHeaders && requestHeaders['organization-id'];
  const isRegistryUser = orgId !== 'individual';
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
        taxpayerIdentificationNumber: submission.taxpayerIdentificationNumber || null,
        nationalProviderIdentifier: submission.nationalProviderIdentifier || null,
        performanceYear: submission.performanceYear
      }});
    }

    const defaultProgramName = 'mips';
    // Look for existing measurementSets with the same category + submissionMethod + cpcPlus practiceId + programName
    const matchingMeasurementSets = existingMeasurementSets.filter((existingMeasurementSet) => {
      const existingProgramName = existingMeasurementSet.programName ? existingMeasurementSet.programName : defaultProgramName;
      const submittedProgramName = measurementSet.programName ? measurementSet.programName : defaultProgramName;

      return (
        (
          (!isRegistryUser && existingMeasurementSet.submitterId === 'securityOfficial') ||
          (isRegistryUser && orgId === existingMeasurementSet.submitterId)
        ) &&
            (existingMeasurementSet.submissionMethod === measurementSet.submissionMethod) &&
            (existingMeasurementSet.category === measurementSet.category) &&
            (!!existingMeasurementSet.practiceId || !!measurementSet.practiceId ? existingMeasurementSet.practiceId === measurementSet.practiceId : true) &&
            (existingProgramName === submittedProgramName)
      );
    });

    if (matchingMeasurementSets.length > 0) {
      // Do a PUT
      const matchingMeasurementSetId = matchingMeasurementSets[0].id;
      promises.push(putMeasurementSet(measurementSetToSubmit, baseOptions, matchingMeasurementSetId));
    } else {
      // Do a POST
      promises.push(postMeasurementSet(measurementSetToSubmit, baseOptions));
    }
  });

  return promises;
}

export const fileUploaderUtil = {
  validateSubmission,
  getExistingSubmission,
  putMeasurementSet,
  postMeasurementSet,
  submitMeasurementSets
};

/**
 * ************************************
 * Private functions
 * *************************************
 */

/*
 * Formats the error type, message, and details into an proper error response object
 *
 * @param {string} type - The type of object that is invalid
 * @param {string} message - The base error message
 * @param {Array<{ message: string, path: string }>} [details] - The details of invalid fields in the invalid object
 * 
 * @return {{type: string, message: string, details: Array<{ message: string, path: string }>}}
 */
function createErrorResponse(type, message, details) {
  return {
    type,
    message,
    details
  };
}

/*
 * Formats field-level details for an invalid object
 *
 * @param {string} type - The type of object that is invalid
 * @param {...[field: string, path: string, message: string]>} details - Pass through an unlimited number of arrays containing field, path, and a message for additional field details
 * 
 * @return {{message: string, path: string}}
 */
function createErrorDetails(type, ...details) {
  return details.map(([field, path, message]) => {
    return {
      message: `field '${field}' in ${type}${path ? '.' + path : ''} is invalid: ${message}`,
      path: `$${path ? '.' + path : ''}.${field}`
    };
  });
}
