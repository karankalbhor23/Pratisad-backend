-- An optional, client-provided UUID makes feedback finalization idempotent without
-- changing or rewriting historical feedback rows.
ALTER TABLE "feedback_submissions"
ADD COLUMN "clientSubmissionId" TEXT,
ADD COLUMN "submissionFingerprint" TEXT;

CREATE UNIQUE INDEX "feedback_submissions_businessId_clientSubmissionId_key"
ON "feedback_submissions"("businessId", "clientSubmissionId");
