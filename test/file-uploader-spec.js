const assert = require('chai').assert;
const sinon = require('sinon');
// const sinon = require('sinon');
const fileUploader = require('../file-uploader');
const fileUploaderUtil = require('../file-uploader-util');

const validSubmission = {
  programName: 'mips',
  entityType: 'individual',
  taxpayerIdentificationNumber: '000123456',
  nationalProviderIdentifier: '0123456789',
  performanceYear: 2017,
  measurementSets: [{
    category: 'ia',
    submissionMethod: 'registry',
    performanceStart: '2017-01-01',
    performanceEnd: '2017-06-01',
    measurements: [{
      measureId: 'IA_EPA_4',
      value: true
    }]
  }]
};

describe('fileUploader', () => {
  const sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  it('never makes it to getExistingSubmission if validateSubmission had an error', () => {
    const validateSubmissionStub = sandbox.stub(fileUploaderUtil, 'validateSubmission').callsFake((submission, submissionFormat, baseOptions) => {
      return new Promise((resolve, reject) => {
        throw new Error('Invalid format');
      });;
    });

    const getExistingSubmissionStub = sandbox.stub(fileUploaderUtil, 'getExistingSubmission').callsFake((submission, baseOptions) => {
      return new Promise((resolve, reject) => {
        resolve({});
      });
    });
    return fileUploader(JSON.stringify(validSubmission), 'FAKE', 'testJWT', '', (err, mSets) => {
        assert.exists(err);
        assert.strictEqual(mSets.length, 0);
        sinon.assert.calledOnce(validateSubmissionStub);
        sinon.assert.notCalled(getExistingSubmissionStub);

        assert.throws(() => {throw err}, 'Invalid format');
    });
  });


  it('throws an error if there are no measurementSets to create', () => {
    const validateSubmissionStub = sandbox.stub(fileUploaderUtil, 'validateSubmission').callsFake((submission, submissionFormat, baseOptions) => {
      return new Promise((resolve, reject) => {
        resolve(Object.assign({}, validSubmission, {measurementSets: []}));
      });
    });

    const getExistingSubmissionStub = sandbox.stub(fileUploaderUtil, 'getExistingSubmission').callsFake((submission, baseOptions) => {
      return new Promise((resolve, reject) => {
        resolve({});
      });
    });

    return fileUploader(JSON.stringify(validSubmission), 'JSON', 'testJWT', '', (err, mSets) => {
        assert.exists(err);
        assert.strictEqual(mSets.length, 0);
        sinon.assert.calledOnce(validateSubmissionStub);
        sinon.assert.notCalled(getExistingSubmissionStub);

        assert.throws(() => {throw err}, 'At least one measurementSet must be defined to use this functionality');
        });
  });

  it('calls postMeasurementSet once first if there\'s no existing submission, before calling submitMeasurementSets', () => {
    const validateSubmissionStub = sandbox.stub(fileUploaderUtil, 'validateSubmission').callsFake((submission, submissionFormat, baseOptions) => {
      return new Promise((resolve, reject) => {
        // Need to do a deep copy here because a nested property
        // gets messed with in the code that deals with the resolve
        // of this Promise
        resolve(JSON.parse(JSON.stringify(validSubmission)));
      });
    });

    const getExistingSubmissionStub = sandbox.stub(fileUploaderUtil, 'getExistingSubmission').callsFake((submission, baseOptions) => {
      return new Promise((resolve, reject) => {
        resolve(null);
      });
    });

    const postMeasurementSetStub = sandbox.stub(fileUploaderUtil, 'postMeasurementSet').callsFake((measurementSet, options) => {
      return new Promise((resolve, reject) => {
        resolve(validSubmission.measurementSets[0]);
      }); 
    });

    const submitMeasurementSetsStub = sandbox.stub(fileUploaderUtil, 'submitMeasurementSets').callsFake((existingSubmission, submission, mSetsToCreate, options) => {
      return [];
    });

    return fileUploader(JSON.stringify(validSubmission), 'JSON', 'testJWT', '', (err, mSets) => {
        assert.strictEqual(err, '');
        assert.strictEqual(mSets.length, 1);
        assert.deepEqual(mSets[0], validSubmission.measurementSets[0]);

        sinon.assert.calledOnce(validateSubmissionStub);
        sinon.assert.calledOnce(getExistingSubmissionStub);

        // This was the call before submitMeasurementSets
        sinon.assert.calledOnce(postMeasurementSetStub);

        sinon.assert.calledOnce(submitMeasurementSetsStub);
        }); 
  });
});
