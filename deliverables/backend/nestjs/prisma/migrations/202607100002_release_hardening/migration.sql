-- Preflight duplicate checks must be run before this migration on an existing database.
ALTER TABLE `health_records` MODIFY `lastAssessmentScore` DECIMAL(4,1) NULL;
ALTER TABLE `assessments`
  MODIFY `totalScore` DECIMAL(4,1) NULL,
  ADD COLUMN `ownerUserId` VARCHAR(191) NULL,
  ADD COLUMN `currentStep` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `expiresAt` DATETIME(3) NULL,
  ADD COLUMN `requestKey` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `assessments_requestKey_key` ON `assessments`(`requestKey`);
CREATE UNIQUE INDEX `family_members_family_sort_uq` ON `family_members`(`familyId`, `sortOrder`);
DROP INDEX `medication_adherence_planId_scheduledAt_idx` ON `medication_adherence`;
CREATE UNIQUE INDEX `medication_adherence_plan_scheduled_uq` ON `medication_adherence`(`planId`, `scheduledAt`);
ALTER TABLE `notifications`
  ADD COLUMN `deliveryStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `notifications_idempotencyKey_key` ON `notifications`(`idempotencyKey`);
CREATE TABLE `family_role_audits` (
  `id` VARCHAR(191) NOT NULL,
  `familyId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `targetMemberId` VARCHAR(191) NOT NULL,
  `oldRole` VARCHAR(191) NOT NULL,
  `newRole` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `requestId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `family_role_audits_familyId_createdAt_idx`(`familyId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `family_role_audits_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `family_role_audits_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `family_role_audits_targetMemberId_fkey` FOREIGN KEY (`targetMemberId`) REFERENCES `family_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
