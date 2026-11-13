import { describe, it, afterEach } from 'mocha';
import { assert } from 'chai';
import sinon from 'sinon';
import axios from 'axios';

import { fileUploader, fileUploaderWithOptions } from '../file-uploader';
import { fileUploaderUtil } from '../file-uploader-util';
import { DUMMY_AUTHORIZATION } from './constants';

// Factories rather than shared constants because the uploader mutates the
// submission it is given (e.g. measurementSets.pop())
const buildValidSubmission = () => ({
  programName: 'mips',
  entityType: 'individual',
  taxpayerIdentificationNumber: '000123456',
  nationalProviderIdentifier: '0123456789',
  performanceYear: 2017,
  measurementSets: [
    {
      category: 'ia',
      submissionMethod: 'registry',
      performanceStart: '2017-01-01',
      performanceEnd: '2017-06-01',
      measurements: [
        {
          measureId: 'IA_EPA_4',
          value: true,
        },
      ],
    },
  ],
});

const buildMeasurementSetToCreate = () => ({
  category: 'aci',
  submissionMethod: 'registry',
  performanceStart: '2017-01-01',
  performanceEnd: '2017-06-01',
  measurements: [
    {
      measureId: 'ACI_HIE_3',
      value: {
        numerator: 2,
        denominator: 3,
      },
    },
  ],
});

// Existing submission has one measurementSet to be replaced by the new
// submission (PUT)
const buildExistingSubmission = () => ({
  programName: 'mips',
  entityType: 'individual',
  taxpayerIdentificationNumber: '000123456',
  nationalProviderIdentifier: '0123456789',
  performanceYear: 2017,
  measurementSets: [
    {
      category: 'ia',
      submissionMethod: 'registry',
      performanceStart: '2017-01-01',
      performanceEnd: '2017-06-01',
      submitterId: 'securityOfficial',
      measurements: [
        {
          measureId: 'IA_EPA_4',
          value: false,
        },
      ],
    },
  ],
});

const requestHeaders = { Authorization: DUMMY_AUTHORIZATION };

describe('file-uploader', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  // Each scenario stubs the network layer and returns the stubs and the inputs
  // so the exact same scenario can drive both the new and the deprecated API.

  const stubValidationFailure = () => {
    const submission = buildValidSubmission();
    const validateSubmissionStub = sandbox
      .stub(fileUploaderUtil, 'validateSubmission')
      .callsFake(() => Promise.reject(new Error('Invalid format')));
    const getExistingSubmissionStub = sandbox
      .stub(fileUploaderUtil, 'getExistingSubmission')
      .callsFake(() => Promise.resolve({}));

    return {
      submissionBody: JSON.stringify(submission),
      submissionFormat: 'FAKE',
      requestHeaders,
      baseSubmissionURL: '',
      validateSubmissionStub,
      getExistingSubmissionStub,
    };
  };

  const stubNoExistingSubmission = ({ warnings } = {}) => {
    const submission = buildValidSubmission();
    const validateSubmissionStub = sandbox
      .stub(fileUploaderUtil, 'validateSubmission')
      .callsFake(() =>
        // Deep copy because the uploader mutates what validation resolves with
        Promise.resolve(JSON.parse(JSON.stringify(submission)))
      );
    const getExistingSubmissionStub = sandbox
      .stub(fileUploaderUtil, 'getExistingSubmission')
      .callsFake(() => Promise.resolve(null));
    const postMeasurementSetStub = sandbox
      .stub(fileUploaderUtil, 'postMeasurementSet')
      .callsFake(() =>
        Promise.resolve(buildValidSubmission().measurementSets[0])
      );
    const submitMeasurementSetsStub = sandbox
      .stub(fileUploaderUtil, 'submitMeasurementSets')
      .callsFake(() => (warnings ? [Promise.resolve({ warnings })] : []));

    return {
      submissionBody: JSON.stringify(submission),
      submissionFormat: 'JSON',
      requestHeaders,
      baseSubmissionURL: '',
      expectedMeasurementSet: submission.measurementSets[0],
      validateSubmissionStub,
      getExistingSubmissionStub,
      postMeasurementSetStub,
      submitMeasurementSetsStub,
    };
  };

  // The existing submission has an `ia` set (PUT, fails) and the new submission
  // adds an `aci` set (POST, succeeds)
  const stubExistingSubmission = () => {
    const submission = buildValidSubmission();
    const measurementSetToCreate = buildMeasurementSetToCreate();
    submission.measurementSets.push(measurementSetToCreate);
    const existingSubmission = buildExistingSubmission();

    sandbox
      .stub(fileUploaderUtil, 'validateSubmission')
      .callsFake(() => Promise.resolve(JSON.parse(JSON.stringify(submission))));
    sandbox
      .stub(fileUploaderUtil, 'getExistingSubmission')
      .callsFake(() => Promise.resolve(existingSubmission));
    const axiosPostStub = sandbox.stub(axios, 'post').callsFake((url, data) =>
      Promise.resolve({
        data: {
          data: {
            measurementSet: JSON.parse(JSON.stringify(data)),
          },
        },
      })
    );
    const axiosPutStub = sandbox
      .stub(axios, 'put')
      .callsFake(() =>
        Promise.reject(new Error('Random Submissions API error'))
      );

    return {
      submissionBody: JSON.stringify(submission),
      submissionFormat: 'JSON',
      requestHeaders: {
        Authorization: DUMMY_AUTHORIZATION,
        'organization-id': 'individual',
      },
      baseSubmissionURL: '',
      measurementSetToCreate,
      axiosPostStub,
      axiosPutStub,
    };
  };

  const getRejection = async (promise) => {
    try {
      await promise;
    } catch (err) {
      return err;
    }
    return assert.fail('expected promise to reject');
  };

  describe('fileUploaderWithOptions', () => {
    it('rejects and never makes it to getExistingSubmission if validateSubmission had an error', async () => {
      const scenario = stubValidationFailure();
      const { validateSubmissionStub, getExistingSubmissionStub } = scenario;

      const err = await getRejection(fileUploaderWithOptions(scenario));

      assert.strictEqual(err.message, 'Invalid format');
      sinon.assert.calledOnce(validateSubmissionStub);
      sinon.assert.notCalled(getExistingSubmissionStub);
    });

    it('passes the url and merged default and request headers to validateSubmission', async () => {
      const scenario = stubNoExistingSubmission();
      const { validateSubmissionStub } = scenario;
      scenario.baseSubmissionURL = 'https://example.test';

      await fileUploaderWithOptions(scenario);

      sinon.assert.calledOnce(validateSubmissionStub);
      sinon.assert.calledWithMatch(
        validateSubmissionStub,
        scenario.submissionBody,
        'JSON',
        {
          url: 'https://example.test',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: DUMMY_AUTHORIZATION,
          },
        }
      );
    });

    it("calls postMeasurementSet once first if there's no existing submission, before calling submitMeasurementSets", async () => {
      const scenario = stubNoExistingSubmission();
      const {
        validateSubmissionStub,
        getExistingSubmissionStub,
        postMeasurementSetStub,
        submitMeasurementSetsStub,
        expectedMeasurementSet,
      } = scenario;

      const result = await fileUploaderWithOptions(scenario);

      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.createdMeasurementSets.length, 1);
      assert.deepEqual(
        result.createdMeasurementSets[0],
        expectedMeasurementSet
      );
      assert.isNull(result.warnings);

      sinon.assert.calledOnce(validateSubmissionStub);
      sinon.assert.calledOnce(getExistingSubmissionStub);
      sinon.assert.calledOnce(postMeasurementSetStub);
      sinon.assert.calledOnce(submitMeasurementSetsStub);
      sinon.assert.callOrder(postMeasurementSetStub, submitMeasurementSetsStub);
    });

    it('returns warnings from submitted measurementSets', async () => {
      const scenario = stubNoExistingSubmission({ warnings: 'some warning' });

      const result = await fileUploaderWithOptions(scenario);

      assert.strictEqual(result.warnings, 'some warning');
      assert.strictEqual(result.errors.length, 0);
    });

    it('resolves with aggregated errors and any created measurementSets, using POST and PUT appropriately', async () => {
      const scenario = stubExistingSubmission();
      const { axiosPostStub, axiosPutStub, measurementSetToCreate } = scenario;

      const result = await fileUploaderWithOptions(scenario);

      sinon.assert.calledOnce(axiosPostStub);
      sinon.assert.calledOnce(axiosPutStub);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(
        result.errors[0].message,
        'Random Submissions API error'
      );
      assert.strictEqual(result.createdMeasurementSets.length, 1);
      assert.deepEqual(
        result.createdMeasurementSets[0].measurementSet,
        measurementSetToCreate
      );
    });
  });

  // fileUploader is deprecated in favor of fileUploaderWithOptions. These tests
  // pin its original callback-based behavior.
  describe('fileUploader (deprecated)', () => {
    it('never makes it to getExistingSubmission if validateSubmission had an error', async () => {
      const {
        validateSubmissionStub,
        getExistingSubmissionStub,
        submissionBody,
        submissionFormat,
        requestHeaders,
        baseSubmissionURL,
      } = stubValidationFailure();
      const callback = sandbox.spy();

      await fileUploader(
        submissionBody,
        submissionFormat,
        requestHeaders,
        baseSubmissionURL,
        callback
      );

      sinon.assert.calledOnce(callback);
      const callbackArgs = callback.firstCall.args;
      // Errors are reported with exactly two arguments: ([err], [])
      assert.strictEqual(callbackArgs.length, 2);
      const [errs, mSets] = callbackArgs;
      assert.strictEqual(errs.length, 1);
      assert.strictEqual(errs[0].message, 'Invalid format');
      assert.deepEqual(mSets, []);
      sinon.assert.calledOnce(validateSubmissionStub);
      sinon.assert.notCalled(getExistingSubmissionStub);
    });

    it("calls postMeasurementSet once first if there's no existing submission, before calling submitMeasurementSets", async () => {
      const {
        validateSubmissionStub,
        getExistingSubmissionStub,
        postMeasurementSetStub,
        submitMeasurementSetsStub,
        expectedMeasurementSet,
        submissionBody,
        submissionFormat,
        requestHeaders,
        baseSubmissionURL,
      } = stubNoExistingSubmission();
      const callback = sandbox.spy();

      await fileUploader(
        submissionBody,
        submissionFormat,
        requestHeaders,
        baseSubmissionURL,
        callback
      );

      sinon.assert.calledOnce(callback);
      const [errs, mSets, warnings] = callback.firstCall.args;
      assert.strictEqual(errs.length, 0);
      assert.strictEqual(mSets.length, 1);
      assert.deepEqual(mSets[0], expectedMeasurementSet);
      assert.isNull(warnings);

      sinon.assert.calledOnce(validateSubmissionStub);
      sinon.assert.calledOnce(getExistingSubmissionStub);
      sinon.assert.calledOnce(postMeasurementSetStub);
      sinon.assert.calledOnce(submitMeasurementSetsStub);
      sinon.assert.callOrder(postMeasurementSetStub, submitMeasurementSetsStub);
    });

    it('passes warnings to the callback as the third argument', async () => {
      const {
        submissionBody,
        submissionFormat,
        requestHeaders,
        baseSubmissionURL,
      } = stubNoExistingSubmission({ warnings: 'some warning' });
      const callback = sandbox.spy();

      await fileUploader(
        submissionBody,
        submissionFormat,
        requestHeaders,
        baseSubmissionURL,
        callback
      );

      sinon.assert.calledOnce(callback);
      assert.strictEqual(callback.firstCall.args[2], 'some warning');
    });

    it('will call the callback with an aggregated error string and any created measurementSets, using POST and PUT appropriately', async () => {
      const {
        axiosPostStub,
        axiosPutStub,
        measurementSetToCreate,
        submissionBody,
        submissionFormat,
        requestHeaders,
        baseSubmissionURL,
      } = stubExistingSubmission();
      const callback = sandbox.spy();

      await fileUploader(
        submissionBody,
        submissionFormat,
        requestHeaders,
        baseSubmissionURL,
        callback
      );

      sinon.assert.calledOnce(callback);
      const [errs, mSets] = callback.firstCall.args;
      sinon.assert.calledOnce(axiosPostStub);
      sinon.assert.calledOnce(axiosPutStub);
      assert.strictEqual(errs.length, 1);
      assert.strictEqual(errs[0].message, 'Random Submissions API error');
      assert.strictEqual(mSets.length, 1);
      assert.deepEqual(mSets[0].measurementSet, measurementSetToCreate);
    });

    it('resolves (never rejects) after calling the callback', async () => {
      const options = stubValidationFailure();
      const callback = sandbox.spy();

      const result = await fileUploader(
        options.submissionBody,
        options.submissionFormat,
        options.requestHeaders,
        options.baseSubmissionURL,
        callback
      );

      assert.isUndefined(result);
      sinon.assert.calledOnce(callback);
    });
  });
});
