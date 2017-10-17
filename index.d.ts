type QppFileUploadClient = {
    fileUploader: (submissionBody: any, submissionFormat: any, JWT: any, baseSubmissionURL: any, callback: any) => any;
};

declare const QppFileUploadClient: QppFileUploadClient;

export = QppFileUploadClient;