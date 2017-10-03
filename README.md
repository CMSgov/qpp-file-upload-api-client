# qpp-file-upload-api-client
A set of functions to call the QPP Submissions API in common manner, such as for the file upload use case.

To use, simply `npm install qpp-file-upload-api-client`

## fileUploader()
The `fileUploader()` function exported by this module uses the following set of requests on the Submissions API:

1. Parse the submission object and call POST /submissions/validate to ensure that it's a valid submission
1. Call GET /submissions with query parameters to find any matching submission and measurementSets
1. Given the result of GET /submissions, determine whether to PUT or POST measurementSets from the file being uploaded

Arguments
---------

1. `submissionBody`: A string containing the QPP JSON or QPP XML Submission body. See the [Submissions API Developer Documentation](cmsgov.github.io/qpp-submissions-docs) for more information on schemas, but you can use this example payload to use with the `fileUploader()` function: [example payload](https://gist.github.com/samskeller/0eeb89ead1ddb189236593e2a9aa1034)
1. `submissionFormat`: A string specifying the format -- only "JSON" and "XML" are supported
1. `JWT`: A string with the user's JSON Web Token (JWT)
1. `baseSubmissionURL`: A string with the base URL to be used to specify the Submissions API -- for the production instance of the Submissions API, for example, you'd use `https://qpp.cms.gov/api/submissions`
1. `callback`: A callback function to be called when the `fileUploader()` function is finished. Should accept a string as the first argument, for an aggregated string of errors (if there are any), and an array of created measurementSets (Objects) as the second argument

## Testing
To run the automated tests for this module, simply run:

```bash
npm test
```
