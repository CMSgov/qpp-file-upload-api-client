const Q = require('q');
const rp = require('request-promise');
const parseString = require('xml2js').parseString;

/*
 * Function for parsing the submission body, provided as a string in
 * JSON or XML, and returning a JS Object. We use the Q module to
 * make it easy to promisify this function, which is nice because
 * parseString() uses a callback
 *
 * @param {String} submissionBody
 * @param {String} submissionFormat
 * @return {Promise}
 */
const parseSubmission = function(submissionBody, submissionFormat) {
  deferred = Q.defer();

  if (submissionFormat === 'JSON') {
    const submission = JSON.parse(submissionBody)
    deferred.resolve(submission);
  } else if (submissionFormat === 'XML') {
    // Use xml2js to parse the XML body
    parseString(submissionBody, function(err, submission) {
      if (err) return deferred.reject(new Error('Invalid XML'));

      return deferred.resolve(submission);
    });
  } else {
    deferred.reject(new Error('Invalid format'));
  };
  
  return deferred.promise;
};

/*
 * Function for validating a submission Object using the /submissions/validate
 * endpoint. Returns nothing if it was successful -- if there was an error,
 * we throw an error
 *
 * @param {Object} submission
 * @param {String} baseSubmissionURL
 * @param {String} JWT
 */
const validateSubmission = function(submission, baseSubmissionURL, JWT) {
  const url = baseSubmissionURL + '/submissions/validate';

  const validateSubmissionOptions = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + JWT,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(submission),
    resolveWithFullResponse: true
  };

  return rp.post(validateSubmissionOptions)
    .then(function(response) {
      if (response.statusCode === 204) return;

      // TODO(sam): Add error from response with paths and whatnot
      throw new Error('Invalid Submission Object');
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
 * @param {String} baseSubmissionURL
 * @param {String} JWT
 * @return {Object}
 */
const getExistingSubmission = function(submission, baseSubmissionURL, JWT) {
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

  url = baseSubmissionURL + '/submissions?' + queryParamString;

  const getSubmissionsOptions = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + JWT,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'qpp-taxpayer-identification-number': submission.taxpayerIdentificationNumber
    },
    resolveWithFullResponse: true
  };

  return rp.get(getSubmissionsOptions)
    .then(function(response) {
      if (response.statusCode !== 200) {
        throw new Error('Could not fetch existing Submissions');
      };

      const jsonBody = JSON.parse(response.body);
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
 * a 200 status code.
 *
 * @param {String} url
 * @param {Object} measurementSet
 * @param {String} JWT
 * @return {Array<String, Object>}
 */
const putMeasurementSet = function(url, measurementSet, JWT) {
  const putMeasurementSetOptions = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(measurementSet),
    resolveWithFullResponse: true
  };

  return rp.put(putMeasurementSetOptions)
    .then(function(response) {
      if (response.statusCode !== 200) {
        return ['PUT /measurement-sets failed: ' + response.body, null];
      }
      return [null, JSON.parse(response.body)];
    });
};

/*
 * Function for calling POST /measurement-sets on the Submissions API. Expects
 * a 201 status code.
 *
 * @param {String} url
 * @param {Object} measurementSet
 * @param {String} JWT
 * @return {Array<String, Object>}
 */
const postMeasurementSet = function(url, measurementSet, JWT) {
  const postMeasurementSetOptions = {
    url: url,
    headers: {
      'Authorization': 'Bearer ' + JWT, 'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(measurementSet),
    resolveWithFullResponse: true
  };

  return rp.post(postMeasurementSetOptions)
    .then(function(response) {
      if (response.statusCode !== 201) {
        return ['PUT /measurement-sets failed: ' + response.body, null];
      }
      return [null, JSON.parse(response.body)];
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
 * @param {String} baseSubmissionURL
 * @param {String} JWT
 * @return {Array<Promise>}
 */
const submitMeasurementSets = function(existingSubmission, submission, baseSubmissionURL, JWT) {
  const promises = [];
  submission.measurementSets.forEach((measurementSet) => {
    let measurementSetToSubmit;
    let existingMeasurementSets = [];
    let err;
    let newMeasurementSet;

    // If there's an existing su bmission, then the measurementSet to submit needs the
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

    // Look for existing measurementSets with the same cateogry + submissionMethod
    const matchingMeasurementSets = existingMeasurementSets.filter((existingMeasurementSet) => {
      return existingMeasurementSet.submissionMethod === measurementSet.submissionMethod &&
        existingMeasurementSet.category === measurementSet.category;
    });
    if (matchingMeasurementSets.length > 0) {
      // Do a PUT
      const matchingMeasurementSetId = matchingMeasurementSets[0].id;
      const putURL = baseSubmissionURL + '/measurement-sets/' + matchingMeasurementSetId;
      promises.push(putMeasurementSet(putURL, measurementSetToSubmit, JWT));
    } else {
      // Do a POST
      const postURL = baseSubmissionURL + '/measurement-sets';
      promises.push(postMeasurementSet(postURL, measurementSetToSubmit, JWT));
    };
  });

  return promises;
};

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
 */
const fileUploader = function(submissionBody, submissionFormat, JWT, baseSubmissionURL, callback) {
  let submission;
  parseSubmission(submissionBody, submissionFormat)
    .then(function(parsedSubmissionObject) {
      submission = parsedSubmissionObject;

      if (!submission.measurementSets || submission.measurementSets.length === 0) {
        throw new Error('At least one measurementSet must be defined to use this functionality');
      };

      return validateSubmission(parsedSubmissionObject, baseSubmissionURL, JWT);
    }).then(function() {
      return getExistingSubmission(submission, baseSubmissionURL, JWT);
    }).then(function(existingSubmission) {
      const postAndPutPromises = submitMeasurementSets(existingSubmission, submission, baseSubmissionURL, JWT);
      return Promise.all(postAndPutPromises);
    }).then(function(postAndPutOutputs) {
      const errs = [];
      const createdMeasurementSets = [];

      // Aggregate the errors and created measurementSets
      postAndPutOutputs.forEach((postOrPutOutput) => {
        if (postOrPutOutput[0]) {
          errs.push(postOrPutOutput[0]);
        };

        if (postOrPutOutput[1]) {
          createdMeasurementSets.push(postOrPutOutput[1]);
        };
      });
      const errString = errs.join('; ');

      // Call the callback with the aggregated error string and list of measurementSets created
      callback(errString, createdMeasurementSets);
    }).catch(function(err) {
      // Call the callback with the aggregated error string and an empty list (no measurementSets created)
      callback(err, []);
    }); 
};

module.exports = fileUploader;
