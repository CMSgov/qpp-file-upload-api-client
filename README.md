# qpp-file-upload-api-client [![Build Status](https://travis-ci.org/CMSgov/qpp-file-upload-api-client.svg?branch=master)](https://travis-ci.org/CMSgov/qpp-file-upload-api-client)

A set of functions to call the QPP Submissions API in common manner, such as for the file upload use case.

To use, simply `npm install qpp-file-upload-api-client`

## fileUploader()

The `fileUploader()` function exported by this module uses the following set of requests on the Submissions API:

1. Parse the submission object and call POST /submissions/validate to ensure that it's a valid submission
1. Call GET /submissions with query parameters to find any matching submission and measurementSets
1. Given the result of GET /submissions, determine whether to PUT or POST measurementSets from the file being uploaded

## Arguments

1.`submissionBody`: A string containing the QPP JSON or QPP XML Submission body. See the [Submissions API Developer Documentation](cmsgov.github.io/qpp-submissions-docs) for more information on schemas

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

## Deployment

This project is backed with a fully automated CI/CD pipeline (GitHub Actions). The pipeline automates the following tasks:

- PR scanning (running tests, linting, etc),
- Automates drafting a release page when you push to master
- Automates publishing the library to NPM

This repo holds two main branches:

The **master** branch is considered to be the main branch where the source code of HEAD always reflects a production-ready state.

The **develop** branch is considered to be the main branch where the source code of HEAD always reflects a state with the latest delivered development changes for the next release.

### Release Workflow

#### Development

1. Create a new feature branch from develop.

    ```bash
    git checkout develop
    git checkout -b feature/qppsf-xxxx
    ```

2. When development is complete on feature branch open a PR into the develop branch and merge.
3. At this stage we should not change the version number.

#### Staging (Beta Release)

**Purpose of this step is to create a beta npm package for testing**
**Do NOT create a PR from this branch**

1. Create a new release branch from the develop branch and update the package and package lock versions

    ```bash
    git checkout develop
    git checkout -b release/x.x.x-beta.0
    # If you are updating minor or major versions, use preminor or premajor instead of prepatch
    npm version --no-git-tag-version prepatch --preid beta
    # stage and commit changes
    git add package.json package-lock.json && git commit -m "Updating package version to x.x.x-beta.0"
    git push
    ```

2. Draft a new pre release [GitHub Release Page](https://github.com/CMSgov/qpp-file-upload-api-client/releases).
   1. Click Draft a new release
   2. Select the target as the release branch you created `release/x.x.x-beta.0`
   3. Create a new tag for the beta version `vx.x.x-beta.0`
   4. Edit the release title to be the version `vx.x.x-beta.0`
   5. Edit the description to include the version `vx.x.x-beta.0` and whatever notes you find relevant
   6. IMPORTANT Mark the release as a pre release
   7. Save draft, or if you are ready to publish now click Publish release and skip the next step

3. When you're ready to publish the beta version to NPM, publish the draft release from the previous step
   1. Open up the draft release, and verify it is marked as a pre release (WARNING: if not then the release will become the latest version on npm!)
   2. select **publish release** to publish the release
      - The npm-beta-publish action should kick off and publish a beta version to [NPM](https://www.npmjs.com/package/qpp-file-upload-api-client?activeTab=versions).
**If an issue is discovered during the testing, please start again with a feature branch**

#### Production

1. Once testing is complete and we are ready to publish final release, create a new release branch from the develop branch.
2. Create a new release branch from the develop branch and update the package and package lock versions

    ```bash
    git checkout develop
    git checkout -b release/x.x.x
    # If you are updating minor or major versions, use minor or major instead of patch
    npm version --no-git-tag-version patch
    # stage and commit changes
    git add package.json package-lock.json && git commit -m "Updating package version to x.x.x"
    git push
    ```

3. Open a PR into **master** from the release branch.
4. Merge **master** PR once all checks have passed, get 1 approval from a reviewer as well.
5. Draft a new release [GitHub Release Page](https://github.com/CMSgov/qpp-file-upload-api-client/releases).
   1. Click Draft a new release
   2. Select the target as the release branch you created `release/x.x.x`
   3. Create a new tag for the beta version `vx.x.x`
   4. Edit the release title to be the version `vx.x.x`
   5. Edit the description to include the version `vx.x.x` and whatever notes you find relevant
   6. Save draft, or if you are ready to publish now click Publish release and skip the next step
6. When you're ready to publish the beta version to NPM, publish the draft release from the previous step
   1. Open up the draft release, and verify it is not marked as a pre release
   2. select **publish release** to publish the release
      - The npm-publish action should kick off and publish a new version to [NPM](https://www.npmjs.com/package/qpp-file-upload-api-client?activeTab=versions).
7. Open a PR into **develop** from **master** to backfill any commits on the release branch that are not in develop.

### Release Troubleshooting

You can check the PR Release, Release Notes, and Release (Publish to NPM) build logs by navigating to [GitHub Actions](https://github.com/CMSgov/qpp-file-upload-api-client/actions). For example, to troubleshoot the NPM release for version `release/v1.3.10` open up the [GitHub Actions](https://github.com/CMSgov/qpp-file-upload-api-client/actions) -> select **Release** -> select **v1.3.10** -> Select **publish-npm**.
