const assert = require('chai').assert;
const sinon = require('sinon');
const rp = require('request-promise');
// const sinon = require('sinon');
const {
  validateSubmission,
  getExistingSubmission,
  postMeasurementSet,
  putMeasurementSet,
  submitMeasurementSets
} = require('../file-uploader-util');

const baseOptions = {
  url: '',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

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

describe('fileUploaderUtils', () => {
  const sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  describe('validateSubmission', () => {
    let rpPostStub;
    beforeEach(() => {
      rpPostStub = sandbox.stub(rp, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 200,
          body: JSON.stringify({
            data: {
              submission: validSubmission
            }
          })
        });
      }));
    });

    it('makes a network call to POST /submissions/validate and returns the submission if successful', () => {
      return validateSubmission(validSubmission, 'JSON', baseOptions)
        .then((returnedSubmission) => {
          sinon.assert.calledOnce(rpPostStub);
          assert.strictEqual(rpPostStub.firstCall.args[0].url, '/submissions/validate');

          assert.deepEqual(validSubmission, returnedSubmission);
        });
    });

    it('throws an error if submissionFormat is something other than XML or JSON', () => {
      return validateSubmission(validSubmission, 'FAKE', baseOptions)
        .catch((err) => {
          assert.throws(() => {throw err}, 'Invalid format');
        });
    });

    it('throws an error if the API returns anything other than a 200', () => {
      rpPostStub.restore();
      rpPostStub = sandbox.stub(rp, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 422,
          body: ''
        });
      }));

      return validateSubmission(validSubmission, 'JSON', baseOptions)
        .catch((err) => {
          assert.throws(() => {throw err}, 'Invalid Submission Object');
        });
    });

    it('will use the Submissions API to convert XML to JSON', () => {
      // Don't need to actually send an XML submission here, just making
      // sure that the "XML" submissionFormat will trigger the right
      // header to be added
      return validateSubmission(validSubmission, 'XML', baseOptions)
        .then((returnedSubmission) => {
          sinon.assert.calledOnce(rpPostStub);
          assert.strictEqual(rpPostStub.firstCall.args[0].headers['Content-Type'], 'application/xml');
          assert.strictEqual(rpPostStub.firstCall.args[0].headers['Accept'], 'application/json');
          console.log('hey');
        });
    });
  });

  describe('getExistingSubmission', () => {
    it('makes a network call to GET /submissions and returns a matching submission if there is one', () => {
      const rpGetStub = sandbox.stub(rp, 'get').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 200,
          body: JSON.stringify({
            data: {
              submissions: [Object.assign({}, validSubmission, {id: '001'})]
            }
          })
        });
      }));

      return getExistingSubmission(validSubmission, baseOptions)
        .then((returnedSubmission) => {
          sinon.assert.calledOnce(rpGetStub);
          assert.strictEqual(rpGetStub.firstCall.args[0].url, '/submissions?nationalProviderIdentifier=' + validSubmission.nationalProviderIdentifier);

          assert.exists(returnedSubmission);
          assert.strictEqual(returnedSubmission.id, '001');
          assert.strictEqual(returnedSubmission.taxpayerIdentificationNumber, validSubmission.taxpayerIdentificationNumber);
        });
    });

    it('throws an error if the API returns anything other than a 200', () => {
      const rpGetStub = sandbox.stub(rp, 'get').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 422,
          body: ''
        });
      }));

      return getExistingSubmission(validSubmission, baseOptions)
        .catch((err) => {
          assert.throws(() => {throw err}, 'Could not fetch existing Submissions');
        });
    });

    it('throws an error if there are more than 1 matching submissions', () => {
      const rpGetStub = sandbox.stub(rp, 'get').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 200,
          body: JSON.stringify({
            data: {
              submissions: [{
                entityId: '123456',
                entityType: 'individual'
              }, {
                entityId: '234567',
                entityType: 'individual'
              }]
            }
          })
        });
      }));

      return getExistingSubmission(validSubmission, baseOptions)
        .catch((err) => {
          assert.throws(() => {throw err}, 'Could not determine which existing Submission matches request');
        });
    });
  });

  describe('putMeasurementSet', () => {
    it('makes a network call to PUT /measurement-sets and returns a measurementSet if it was valid', () => {
      const rpPutStub = sandbox.stub(rp, 'put').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 200,
          body: JSON.stringify({
            data: {
              measurementSet: validSubmission.measurementSets[0]
            }
          })
        });
      }));

      return putMeasurementSet(validSubmission.measurementSets[0], baseOptions, '001')
        .then((returnedArray) => {
          sinon.assert.calledOnce(rpPutStub);
          assert.strictEqual(rpPutStub.firstCall.args[0].url, '/measurement-sets/001');

          const err = returnedArray[0];
          const mSet = returnedArray[1];

          assert.notExists(err);
          assert.exists(mSet);
          assert.deepEqual(validSubmission.measurementSets[0], mSet);
        });
    });

    it('throws an error if the API returns anything other than a 200', () => {
      const rpPutStub = sandbox.stub(rp, 'put').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 422,
          body: ''
        });
      }));

      return putMeasurementSet(validSubmission, baseOptions, '001')
        .catch((err) => {
          assert.throws(() => {throw err}, 'PUT /measurement-sets failed: ');
        });
    });

  });

  describe('postMeasurementSet', () => {
    it('makes a network call to POST /measurement-sets and returns a measurementSet if it was valid', () => {
      const rpPostStub = sandbox.stub(rp, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 201,
          body: JSON.stringify({
            data: {
              measurementSet: validSubmission.measurementSets[0]
            }
          })
        });
      }));

      return postMeasurementSet(validSubmission.measurementSets[0], baseOptions)
        .then((returnedArray) => {
          sinon.assert.calledOnce(rpPostStub);
          assert.strictEqual(rpPostStub.firstCall.args[0].url, '/measurement-sets');

          const err = returnedArray[0];
          const mSet = returnedArray[1];

          assert.notExists(err);
          assert.exists(mSet);
          assert.deepEqual(validSubmission.measurementSets[0], mSet);
        });
    });

    it('throws an error if the API returns anything other than a 200', () => {
      const rpPostStub = sandbox.stub(rp, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          statusCode: 422,
          body: ''
        });
      }));

      return postMeasurementSet(validSubmission, baseOptions, '001')
        .catch((err) => {
          assert.throws(() => {throw err}, 'POST /measurement-sets failed: ');
        });
    });

  });

  describe('submitMeasurementSets', () => {
    let rpPostStub;
    let rpPutStub;
    beforeEach(() => {
      rpPostStub = sandbox.stub(rp, 'post').callsFake((mSet, options) => {
        return new Promise((resolve, reject) => {
          resolve([null, mSet]);
        });
      });
      rpPutStub = sandbox.stub(rp, 'put').callsFake((mSet, options, mSetId) => {
        return new Promise((resolve, reject) => {
          resolve([null, mSet]);
        });
      });
    });

    it('will call POST for all new measurementSets and PUT for all existing measurementSets', () => {
      const validSubmissionMoreMSets = Object.assign({}, validSubmission);
      validSubmissionMoreMSets.measurementSets.push({
        category: 'aci',
        submissionMethod: 'claims',
        performanceStart: '2017-01-01',
        performanceEnd: '2017-06-01',
        measurements: [{
          measureId: 'ACI_HIE_3',
          value: {
            numerator: 2,
            denominator: 3
          }
        }]
      });

      const existingSubmission = {
        id: '001',
        measurementSets: [{
          category: 'ia',
          submissionMethod: 'registry',
          performanceStart: '2017-01-01',
          performanceEnd: '2017-06-01',
          measurements: [{
            measureId: 'IA_EPA_4',
            value: true
          }]
        }, {
          category: 'aci',
          submissionMethod: 'registry',
          performanceStart: '2017-01-01',
          performanceEnd: '2017-06-01',
          measurements: [{
            measureId: 'ACI_HIE_3',
            value: {
              numerator: 1,
              denominator: 2
            }
          }]
        }]
      };

      const promiseArray = submitMeasurementSets(existingSubmission, {}, validSubmissionMoreMSets.measurementSets, {});
      return Promise.all(promiseArray)
        .then((promiseOutputs) => {
          sinon.assert.calledOnce(rpPostStub)
          sinon.assert.calledOnce(rpPutStub)
        });
    });
  });
});
