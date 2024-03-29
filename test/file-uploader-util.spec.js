import { describe, it, afterEach, beforeEach } from 'mocha';
import { assert } from 'chai';
import sinon from 'sinon';
import axios from 'axios';

import {
  validateSubmission,
  getExistingSubmission,
  postMeasurementSet,
  putMeasurementSet,
  submitMeasurementSets
} from '../file-uploader-util';
import { DUMMY_AUTHORIZATION } from './constants';

const baseOptions = {
  url: '',
  headers: {
    Accept: 'application/json',
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

const putSubmissionWithReadyOnlyFields = {
  programName: 'mips',
  entityType: 'individual',
  taxpayerIdentificationNumber: '000123456',
  nationalProviderIdentifier: '0123456789',
  performanceYear: 2017,
  id: 'abc',
  measurementSets: [{
    category: 'ia',
    submissionMethod: 'registry',
    performanceStart: '2017-01-01',
    performanceEnd: '2017-06-01',
    submissionId: 'abc',
    id: 'some-mset-id',
    measurements: [{
      measureId: 'IA_EPA_4',
      value: true
    }]
  }]
};

const postSubmissionWithReadyOnlyFields = {
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
    suppressed: true,
    measurements: [{
      measureId: 'IA_EPA_4',
      value: true
    }]
  }]
};

const cpcPlusSubmission = {
  programName: 'mips',
  entityType: 'individual',
  taxpayerIdentificationNumber: '000123456',
  nationalProviderIdentifier: '0123456789',
  performanceYear: 2017,
  measurementSets: [{
    category: 'quality',
    programName: 'cpcPlus',
    practiceId: '000123458',
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
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('validateSubmission', () => {
    let axiosPostStub;
    beforeEach(() => {
      axiosPostStub = sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              submission: validSubmission
            }
          }
        });
      }));
    });

    it('makes a network call to POST /public/validate-submission and returns the submission if successful', () => {
      return validateSubmission(validSubmission, 'JSON', baseOptions)
        .then((returnedSubmission) => {
          sinon.assert.calledOnce(axiosPostStub);
          assert.strictEqual(axiosPostStub.firstCall.args[0], '/public/validate-submission');

          assert.deepEqual(validSubmission, returnedSubmission);
        });
    });

    it('throws an error if submissionFormat is something other than XML or JSON', () => {
      return validateSubmission(validSubmission, 'FAKE', baseOptions)
        .catch((err) => {
          assert.deepEqual(err, {
            type: 'ValidationError',
            message: 'Invalid file type',
            details: undefined
          });
        });
    });

    it('throws an error if the API returns anything other than a 201', () => {
      axiosPostStub.restore();
      axiosPostStub = sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        reject(new Error('Invalid Submission Object'));
      }));

      return validateSubmission(validSubmission, 'JSON', baseOptions)
        .catch((err) => {
          assert.throws(() => {
            throw err;
          }, 'Invalid Submission Object');
        });
    });

    it('throws an error if there are no measurementSets to create', () => {
      const validSubmissionNoMsets = Object.assign({}, validSubmission, {measurementSets: []});
      axiosPostStub.restore();
      axiosPostStub = sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              submission: validSubmissionNoMsets
            }
          }
        });
      }));

      return validateSubmission(validSubmissionNoMsets, 'JSON', baseOptions)
        .catch((err) => {
          assert.deepEqual(err, {
            type: 'ValidationError',
            message: 'At least one measurementSet must be defined to use this functionality',
            details: [
              {
                message: 'field \'measurementSets\' in Submission is invalid: At least one measurementSet must be defined to use this functionality',
                path: '$.measurementSets'
              }
            ]
          });
        });
    });

    it('throws an error if there are measurementSets with submissionMethod cmsWebInterface', () => {
      const validSubmissionBadSubmissionMethod = Object.assign({}, validSubmission, {measurementSets: [
        { submissionMethod: 'cmsWebInterface' }
      ]});
      axiosPostStub.restore();
      axiosPostStub = sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              submission: validSubmissionBadSubmissionMethod
            }
          }
        });
      }));

      const errorMessage = 'field \'submissionMethod\' in Submission.measurementSets[0] is invalid: \'cmsWebInterface\' submission method' +
          ' is not allowed via file upload. registry and electronicHealthRecord are the only allowed submission methods.';

      return validateSubmission(validSubmissionBadSubmissionMethod, 'JSON', baseOptions)
        .catch((err) => {
          assert.deepEqual(err, {
            type: 'ValidationError',
            message: 'Measurement set contains a disallowed submission method',
            details: [
              {
                message: errorMessage,
                path: '$.measurementSets[0].submissionMethod'
              }
            ]
          });
        });
    });

    it('throws an error if there are measurementSets with submissionMethod webAttestation', () => {
      const validSubmissionBadSubmissionMethod = Object.assign({}, validSubmission, {measurementSets: [
        { submissionMethod: 'webAttestation' }
      ]});
      axiosPostStub.restore();
      axiosPostStub = sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              submission: validSubmissionBadSubmissionMethod
            }
          }
        });
      }));

      const errorMessage = 'field \'submissionMethod\' in Submission.measurementSets[0] is invalid: \'webAttestation\' submission method' +
          ' is not allowed via file upload. registry and electronicHealthRecord are the only allowed submission methods.';

      return validateSubmission(validSubmissionBadSubmissionMethod, 'JSON', baseOptions)
        .catch((err) => {
          assert.deepEqual(err, {
            type: 'ValidationError',
            message: 'Measurement set contains a disallowed submission method',
            details: [
              {
                message: errorMessage,
                path: '$.measurementSets[0].submissionMethod'
              }
            ]
          });
        });
    });

    it('throws an error if there are measurementSets with non-existent submissionMethod', () => {
      const validSubmissionBadSubmissionMethod = Object.assign({}, validSubmission, {measurementSets: [
        { submissionMethod: 'madeUpSubmissionMethod' }
      ]});
      axiosPostStub.restore();
      axiosPostStub = sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              submission: validSubmissionBadSubmissionMethod
            }
          }
        });
      }));

      const errorMessage = 'field \'submissionMethod\' in Submission.measurementSets[0] is invalid: \'madeUpSubmissionMethod\' submission method' +
              ' is not allowed via file upload. registry and electronicHealthRecord are the only allowed submission methods.';

      return validateSubmission(validSubmissionBadSubmissionMethod, 'JSON', baseOptions)
        .catch((err) => {
          assert.deepEqual(err, {
            type: 'ValidationError',
            message: 'Measurement set contains a disallowed submission method',
            details: [
              {
                message: errorMessage,
                path: '$.measurementSets[0].submissionMethod'
              }
            ]
          });
        });
    });

    it('will use the Submissions API to convert XML to JSON', () => {
      // Don't need to actually send an XML submission here, just making
      // sure that the "XML" submissionFormat will trigger the right
      // header to be added
      return validateSubmission(validSubmission, 'XML', baseOptions)
        .then((returnedSubmission) => {
          sinon.assert.calledOnce(axiosPostStub);
          assert.strictEqual(axiosPostStub.firstCall.args[2].headers['Content-Type'], 'application/xml');
          assert.strictEqual(axiosPostStub.firstCall.args[2].headers['Accept'], 'application/json');
        });
    });
  });

  describe('getExistingSubmission', () => {
    it('makes a network call to GET /submissions and returns a matching submission if there is one', () => {
      const axiosGetStub = sandbox.stub(axios, 'get').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              submissions: [Object.assign({}, validSubmission, {id: '001'})]
            }
          }
        });
      }));

      return getExistingSubmission(validSubmission, baseOptions)
        .then((returnedSubmission) => {
          sinon.assert.calledOnce(axiosGetStub);
          assert.strictEqual(axiosGetStub.firstCall.args[0], `/submissions?nationalProviderIdentifier=${validSubmission.nationalProviderIdentifier}&performanceYear=${validSubmission.performanceYear}&entityType=${validSubmission.entityType}`);

          assert.exists(returnedSubmission);
          assert.strictEqual(returnedSubmission.id, '001');
          assert.strictEqual(returnedSubmission.taxpayerIdentificationNumber, validSubmission.taxpayerIdentificationNumber);
        });
    });

    it('throws an error if the API returns anything other than a 200', () => {
      sandbox.stub(axios, 'get').returns(new Promise((resolve, reject) => {
        reject(new Error('Could not fetch existing Submissions'));
      }));

      return getExistingSubmission(validSubmission, baseOptions)
        .catch((err) => {
          assert.throws(() => {
            throw err;
          }, 'Could not fetch existing Submissions');
        });
    });

    it('throws an error if there are more than 1 matching submissions', () => {
      sandbox.stub(axios, 'get').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              submissions: [{
                entityId: '123456',
                entityType: 'individual'
              }, {
                entityId: '234567',
                entityType: 'individual'
              }]
            }
          }
        });
      }));

      return getExistingSubmission(validSubmission, baseOptions)
        .catch((err) => {
          assert.deepEqual(err, {
            type: 'ValidationError',
            message: 'Could not determine which existing Submission matches request',
            details: undefined
          });
        });
    });

    it('filters existing submissions on entityType if there are more than 1 matching', () => {
      const axiosGetStub = sandbox.stub(axios, 'get').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              submissions: [{
                entityId: '123456',
                entityType: 'individual'
              }, {
                entityId: '234567',
                entityType: 'group'
              }]
            }
          }
        });
      }));

      return getExistingSubmission(validSubmission, baseOptions)
        .then((returnedSubmission) => {
          sinon.assert.calledOnce(axiosGetStub);
          assert.strictEqual(axiosGetStub.firstCall.args[0], `/submissions?nationalProviderIdentifier=${validSubmission.nationalProviderIdentifier}&performanceYear=${validSubmission.performanceYear}&entityType=${validSubmission.entityType}`);

          assert.exists(returnedSubmission);
          assert.strictEqual(returnedSubmission.entityId, '123456');
          assert.strictEqual(returnedSubmission.entityType, 'individual');
        });
    });
  });

  describe('putMeasurementSet', () => {
    it('makes a network call to PUT /measurement-sets and returns a measurementSet if it was valid', () => {
      const axiosPutStub = sandbox.stub(axios, 'put').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              measurementSet: validSubmission.measurementSets[0]
            }
          }
        });
      }));

      return putMeasurementSet(validSubmission.measurementSets[0], baseOptions, '001')
        .then((mSet) => {
          sinon.assert.calledOnce(axiosPutStub);
          assert.strictEqual(axiosPutStub.firstCall.args[0], '/measurement-sets/001');

          assert.exists(mSet);
          assert.deepEqual(validSubmission.measurementSets[0], mSet.measurementSet);
        });
    });

    it('makes a network call to PUT /measurement-sets with nestJs read only properties removed', () => {
      const axiosPutStub = sandbox.stub(axios, 'put').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              measurementSet: validSubmission.measurementSets[0]
            }
          }
        });
      }));

      return putMeasurementSet(putSubmissionWithReadyOnlyFields.measurementSets[0], baseOptions, '001')
        .then((mSet) => {
          sinon.assert.calledOnce(axiosPutStub);
          assert.strictEqual(axiosPutStub.firstCall.args[0], '/measurement-sets/001');

          assert.exists(mSet);
          assert.deepEqual(validSubmission.measurementSets[0], mSet.measurementSet);
        });
    });

    it('throws an error if the API returns anything other than a 200', () => {
      sandbox.stub(axios, 'put').returns(new Promise((resolve, reject) => {
        reject(new Error('Random API Error'));
      }));

      return putMeasurementSet(validSubmission, baseOptions, '001')
        .catch((err) => {
          assert.throws(() => {
            throw err;
          }, 'Random API Error');
        });
    });

  });

  describe('postMeasurementSet', () => {
    it('makes a network call to POST /measurement-sets and returns a measurementSet if it was valid', () => {
      const axiosPostStub = sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              measurementSet: validSubmission.measurementSets[0],
              warnings: ['test warning']
            }
          }
        });
      }));

      return postMeasurementSet(validSubmission.measurementSets[0], baseOptions)
        .then((mSet) => {
          sinon.assert.calledOnce(axiosPostStub);
          assert.strictEqual(axiosPostStub.firstCall.args[0], '/measurement-sets');

          assert.exists(mSet);
          assert.deepEqual(validSubmission.measurementSets[0], mSet.measurementSet);
          assert.deepEqual(['test warning'], mSet.warnings);
        });
    });

    it('makes a network call to POST /measurement-sets with nestJs read only properties removed', () => {
      const axiosPostStub = sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        resolve({
          data: {
            data: {
              measurementSet: validSubmission.measurementSets[0],
              warnings: ['test warning']
            }
          }
        });
      }));

      return postMeasurementSet(postSubmissionWithReadyOnlyFields.measurementSets[0], baseOptions)
        .then((mSet) => {
          sinon.assert.calledOnce(axiosPostStub);
          assert.strictEqual(axiosPostStub.firstCall.args[0], '/measurement-sets');

          assert.exists(mSet);
          assert.deepEqual(validSubmission.measurementSets[0], mSet.measurementSet);
          assert.deepEqual(['test warning'], mSet.warnings);
        });
    });

    it('throws an error if the API returns anything other than a 201', () => {
      sandbox.stub(axios, 'post').returns(new Promise((resolve, reject) => {
        reject(new Error('Random API Error'));
      }));

      return postMeasurementSet(validSubmission, baseOptions, '001')
        .catch((err) => {
          assert.throws(() => {
            throw err;
          }, 'Random API Error');
        });
    });

  });

  describe('submitMeasurementSets', () => {
    let axiosPostStub;
    let axiosPutStub;
    beforeEach(() => {
      axiosPostStub = sandbox.stub(axios, 'post').callsFake((mSet, options) => {
        return new Promise((resolve, reject) => {
          resolve({
            data: {
              data: {measurementSet: mSet}
            }
          });
        });
      });
      axiosPutStub = sandbox.stub(axios, 'put').callsFake((mSet, options, mSetId) => {
        return new Promise((resolve, reject) => {
          resolve({
            data: {
              data: {measurementSet: mSet}
            }
          });
        });
      });
    });

    it('will call POST for all new measurementSets', () => {
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

      const promiseArray = submitMeasurementSets(existingSubmission, validSubmissionMoreMSets, {}, { Authorization: DUMMY_AUTHORIZATION });
      return Promise.all(promiseArray)
        .then((promiseOutputs) => {
          sinon.assert.calledOnce(axiosPostStub);
          sinon.assert.calledOnce(axiosPutStub);
        });
    });

    it('will call POST for additional cpcPlus measurement sets', () => {
      const validSubmissionMoreMSets = JSON.parse(JSON.stringify(cpcPlusSubmission));
      validSubmissionMoreMSets.measurementSets.push(
        {
          category: 'quality',
          submissionMethod: 'electronicHealthRecord',
          programName: 'cpcPlus',
          practiceId: '000123749',
          performanceStart: '2017-01-01',
          performanceEnd: '2017-06-01',
          measurements: [{
            measureId: 'IA_EPA_4',
            value: true
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

      const promiseArray = submitMeasurementSets(existingSubmission, validSubmissionMoreMSets, {}, { Authorization: DUMMY_AUTHORIZATION });
      return Promise.all(promiseArray)
        .then((promiseOutputs) => {
          sinon.assert.calledTwice(axiosPostStub);
        });
    });

    it('will call PUT for existing measurement sets compared by category + submissionMethod + cpcPlus practiceId + programName', () => {
      const validSubmissionMoreMSets = JSON.parse(JSON.stringify(cpcPlusSubmission));
      validSubmissionMoreMSets.measurementSets.push(
        {
          category: 'quality',
          submissionMethod: 'registry',
          programName: 'cpcPlus',
          practiceId: '000123749',
          performanceStart: '2017-01-01',
          performanceEnd: '2017-06-01',
          measurements: [{
            measureId: 'IA_EPA_4',
            value: true
          }]
        });

      const existingSubmission = {
        id: '001',
        measurementSets: [{
          category: 'quality',
          submissionMethod: 'registry',
          practiceId: '000123749',
          programName: 'cpcPlus',
          performanceStart: '2017-01-01',
          performanceEnd: '2017-06-01',
          measurements: [{
            measureId: 'IA_EPA_4',
            value: true
          }]
        }]
      };

      const promiseArray = submitMeasurementSets(existingSubmission, validSubmissionMoreMSets, {}, { Authorization: DUMMY_AUTHORIZATION });
      return Promise.all(promiseArray)
        .then((promiseOutputs) => {
          sinon.assert.calledOnce(axiosPutStub);
        });
    });

    it('will call POST for non-existing measurement sets compared by category + submissionMethod + cpcPlus practiceId + programName, different programName', () => {
      const validSubmissionMoreMSets = JSON.parse(JSON.stringify(cpcPlusSubmission));

      const existingSubmission = {
        programName: 'mips',
        entityType: 'individual',
        taxpayerIdentificationNumber: '000123456',
        nationalProviderIdentifier: '0123456789',
        performanceYear: 2017,
        measurementSets: [{
          category: 'quality',
          programName: 'mips',
          practiceId: '000123458',
          submissionMethod: 'registry',
          performanceStart: '2017-01-01',
          performanceEnd: '2017-06-01',
          measurements: [{
            measureId: 'IA_EPA_4',
            value: true
          }]
        }]
      };

      const promiseArray = submitMeasurementSets(existingSubmission, validSubmissionMoreMSets, {}, { Authorization: DUMMY_AUTHORIZATION });
      return Promise.all(promiseArray)
        .then((promiseOutputs) => {
          sinon.assert.calledOnce(axiosPostStub);
        });
    });

    it('will call PUT for existing measurement sets compared by category + submissionMethod + cpcPlus practiceId + programName, default programName of mips used', () => {
      let originalSubmission = cpcPlusSubmission;

      originalSubmission.measurementSets.forEach(mset => {
        mset.programName = '';
      });

      const validSubmissionMoreMSets = JSON.parse(JSON.stringify(originalSubmission));

      const existingSubmission = {
        entityType: 'individual',
        taxpayerIdentificationNumber: '000123456',
        nationalProviderIdentifier: '0123456789',
        performanceYear: 2017,
        measurementSets: [{
          category: 'quality',
          practiceId: '000123458',
          submissionMethod: 'registry',
          performanceStart: '2017-01-01',
          performanceEnd: '2017-06-01',
          measurements: [{
            measureId: 'IA_EPA_4',
            value: true
          }]
        }]
      };

      const promiseArray = submitMeasurementSets(existingSubmission, validSubmissionMoreMSets, {}, { Authorization: DUMMY_AUTHORIZATION });
      return Promise.all(promiseArray)
        .then((promiseOutputs) => {
          sinon.assert.calledOnce(axiosPutStub);
        });
    });
  });
});
