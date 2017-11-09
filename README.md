# qpp-file-upload-api-client
A set of functions to call the QPP Submissions API in common manner, such as for the file upload use case.

To use, simply `npm install qpp-file-upload-api-client`

## fileUploader()

The `fileUploader()` function exported by this module uses the following set of requests on the Submissions API:

1. Parse the submission object and call POST /submissions/validate to ensure that it's a valid submission
1. Call GET /submissions with query parameters to find any matching submission and measurementSets
1. Given the result of GET /submissions, determine whether to PUT or POST measurementSets from the file being uploaded

## Arguments

1.`submissionBody`: A string containing the QPP JSON or QPP XML Submission body. See the [Submissions API Developer Documentation](cmsgov.github.io/qpp-submissions-docs) for more information on schemas, but you can use this example payload to use with the `fileUploader()` function: [example payload](https://gist.github.com/samskeller/0eeb89ead1ddb189236593e2a9aa1034)

2.`submissionFormat`: A string specifying the format -- only "JSON" and "XML" are supported

3.`JWT`: A string with the user's JSON Web Token (JWT)

4.`baseSubmissionURL`: A string with the base URL to be used to specify the Submissions API -- for the production instance of the Submissions API, for example, you'd use `https://qpp.cms.gov/api/submissions`

5.`callback: (errors: ResponseError[], measurementSets: MeasurementSet[]): void`: A callback function to be called when the `fileUploader()` function is finished. Should accept an array of Error objects as the first argument, for the list of ResponseError that were thrown during the function call, and an array of created measurementSets (Objects) as the second argument

### Callback Response Example

```javascript
// ResponseError[]
[
    {
        type: string (optional),
        message: string (optional),
        details: (optional) [
            {
                message: string,
                path: string
            }
        ]
    }
]

// Measurement Set[]
{
    "id": "060eb4b1-1a93-467e-b3eb-0b8518ed4d49",
    "submissionId": "060eb4b1-1a93-467e-b3eb-0b8518ed4d49",
    "category": "ia",
    "submissionMethod": "cmsWebInterface",
    "submitterId": "060eb4b1-1a93-467e-b3eb-0b8518ed4d49",
    "submitterType": "organization",
    "performanceStart": "2017-01-01",
    "performanceEnd": "2017-06-01",
    "measurements": [
    {
        "measureId": "IA_EPA_4",
        "value": true,
        "id": "b24aa2c2-f1ab-4d28-a7a4-882d93e5a31d",
        "measurementSetId": "d2acc2af-8382-402e-aa97-0fd118451b22"
    }
    ]
}
```

## Testing

To run the automated tests for this module, simply run:

```bash
npm test
```
