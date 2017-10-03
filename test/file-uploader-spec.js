const assert = require('chai').assert;
const sinon = require('sinon');
const rp = require('request-promise');

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

  it('will call the callback with an aggregated error string and any created measurementSets, using POST and PUT appropriately', () => {
    // Existing submission will have one measurementSet to be replaced by the new submission (PUT)
    // and the new submission will create a new measurementSet as well (POST)
    const existingSubmission = {
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
          value: false
        }]
      }]
    };
    const validSubmissionMoreMsets = Object.assign({}, validSubmission);
    const measurementSetToCreate = {
      category: 'aci',
      submissionMethod: 'registry',
      performanceStart: '2017-01-01',
      performanceEnd: '2017-06-01',
      measurements: [{
        measureId: 'ACI_HIE_3',
        value: {
          numerator: 2,
          denominator: 3
        }
      }]
    };
    validSubmissionMoreMsets.measurementSets.push(measurementSetToCreate);

    const validateSubmissionStub = sandbox.stub(fileUploaderUtil, 'validateSubmission').callsFake((submission, submissionFormat, baseOptions) => {
      return new Promise((resolve, reject) => {
        // Need to do a deep copy here because a nested property
        // gets messed with in the code that deals with the resolve
        // of this Promise
        resolve(JSON.parse(JSON.stringify(validSubmissionMoreMsets)));
      });
    });

    const getExistingSubmissionStub = sandbox.stub(fileUploaderUtil, 'getExistingSubmission').callsFake((submission, baseOptions) => {
      return new Promise((resolve, reject) => {
        resolve(existingSubmission);
      });
    });

    const rpPostStub = sandbox.stub(rp, 'post').callsFake((options) => {
      return new Promise((resolve, reject) => {
        const measurementSetBody = JSON.parse(options.body);
        const responseBody = {
          data: {
            measurementSet: measurementSetBody
          }
        };
        resolve(JSON.stringify(responseBody));
      });
    });

    const rpPutStub = sandbox.stub(rp, 'put').callsFake((options) => {
      return new Promise((resolve, reject) => {
        reject(new Error('Random Submissions API error'));
      });
    });

    return fileUploader(JSON.stringify(validSubmissionMoreMsets), 'JSON', 'testJWT', '', (err, mSets) => {
      sinon.assert.calledOnce(rpPostStub);
      sinon.assert.calledOnce(rpPutStub);

      assert.include(err, 'Random Submissions API error');
      assert.strictEqual(mSets.length, 1);
      assert.deepEqual(mSets[0], measurementSetToCreate);
    });
  });
});
