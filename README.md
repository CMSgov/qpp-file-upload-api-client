# qpp-file-upload-api-client
A set of functions to call the QPP Submissions API in common manner, such as for the file upload use case.

To use, simply `npm install qpp-file-upload-api-client`

## fileUploader()
The `fileUploader()` function exported by this module uses the following set of requests on the Submissions API:

1. Parse the submission object and call POST /submissions/validate to ensure that it's a valid submission
1. Call GET /submissions with query parameters to find any matching submission and measurementSets
1. Given the result of GET /submissions, determine whether to PUT or POST measurementSets from the file being uploaded

An example payload to use with the `fileUploader()` function:
```
{
  "programName": "mips",
  "entityType": "individual",
  "taxpayerIdentificationNumber": "000456789",
  "nationalProviderIdentifier": "0876543210",
  "performanceYear": 2017,
  "measurementSets": [
    {
      "category": "ia",
      "submissionMethod": "cmsWebInterface",
      "performanceStart": "2017-01-01",
      "performanceEnd": "2017-06-01",
      "measurements": [
        {
          "measureId": "IA_EPA_4",
          "value": true
        }
      ]
    },
    {
      "category": "aci",
      "submissionMethod": "cmsWebInterface",
      "performanceStart": "2017-01-01",
      "performanceEnd": "2017-06-01",
      "measurements": [
        {
          "measureId": "ACI_HIE_3",
          "value": {
            "numerator": 1,
            "denominator": 2
          }
        }
      ]
    },
    {
      "category": "quality",
      "submissionMethod": "cmsWebInterface",
      "measureSet": "pediatrics",
      "performanceStart": "2017-01-01",
      "performanceEnd": "2017-06-01",
      "measurements": [
        {
          "measureId": "093",
          "value": {
            "isEndToEndReported": false,
            "performanceMet": 1,
            "performanceNotMet": 1,
            "eligiblePopulation": 5,
            "eligiblePopulationExclusion": 1,
            "eligiblePopulationException": 1
          }
        }
      ]
    }
  ]
}
```
