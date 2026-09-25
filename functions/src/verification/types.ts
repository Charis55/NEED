export interface CertificateExtraction {
  applicantNameOnDocument: string;
  certificateNumber: string;
  issuingBody: string;
  issueDate: string | null;
  documentHash: string;
  tamperScore: number;
}

export interface PoliceClearanceExtraction {
  applicantNameOnDocument: string;
  identificationNumberOnDocument: string;
  possapReferenceNumber: string | null;
  issueDate: string | null;
  documentHash: string;
  tamperScore: number;
}
