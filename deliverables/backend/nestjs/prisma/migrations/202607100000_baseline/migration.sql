-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `wxOpenid` VARCHAR(191) NOT NULL,
    `wxUnionid` VARCHAR(191) NULL,
    `nickname` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `gender` INTEGER NULL,
    `birthday` DATETIME(3) NULL,
    `ageGroup` VARCHAR(191) NULL,
    `isElderlyMode` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_wxOpenid_key`(`wxOpenid`),
    INDEX `users_wxOpenid_idx`(`wxOpenid`),
    INDEX `users_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `deviceInfo` TEXT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `refresh_tokens_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `families` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `memberCount` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `family_members` (
    `id` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'member',
    `nickname` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `age` INTEGER NULL,
    `gender` INTEGER NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `family_members_userId_idx`(`userId`),
    INDEX `family_members_familyId_idx`(`familyId`),
    UNIQUE INDEX `family_members_familyId_userId_key`(`familyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_records` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `bloodType` VARCHAR(191) NULL,
    `heightCm` DOUBLE NULL,
    `weightKg` DOUBLE NULL,
    `chronicDiseases` VARCHAR(4000) NOT NULL DEFAULT '[]',
    `allergies` VARCHAR(4000) NOT NULL DEFAULT '[]',
    `surgeries` VARCHAR(4000) NOT NULL DEFAULT '[]',
    `familyHistory` VARCHAR(4000) NOT NULL DEFAULT '[]',
    `vaccinations` VARCHAR(4000) NOT NULL DEFAULT '[]',
    `lastCheckupDate` DATETIME(3) NULL,
    `checkupSummary` TEXT NULL,
    `lastAssessmentId` VARCHAR(191) NULL,
    `lastAssessmentScore` INTEGER NULL,
    `lastAssessmentDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `health_records_memberId_key`(`memberId`),
    INDEX `health_records_memberId_idx`(`memberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessments` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'initial',
    `totalScore` INTEGER NULL,
    `categoryScores` TEXT NULL,
    `topConcerns` TEXT NOT NULL,
    `radarChart` TEXT NULL,
    `fullAnalysis` TEXT NULL,
    `rawAnswers` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `completedAt` DATETIME(3) NULL,
    `nextReviewAt` DATETIME(3) NULL,
    `reviewNotified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `assessments_memberId_createdAt_idx`(`memberId`, `createdAt`),
    INDEX `assessments_familyId_createdAt_idx`(`familyId`, `createdAt`),
    INDEX `assessments_nextReviewAt_reviewNotified_idx`(`nextReviewAt`, `reviewNotified`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consultations` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `queryText` TEXT NOT NULL,
    `inputType` VARCHAR(191) NOT NULL DEFAULT 'text',
    `responseText` TEXT NULL,
    `responseType` VARCHAR(191) NULL,
    `redLineTriggered` BOOLEAN NOT NULL DEFAULT false,
    `redLineCategory` VARCHAR(191) NULL,
    `redLineSeverity` VARCHAR(191) NULL,
    `selfHarmDetected` BOOLEAN NOT NULL DEFAULT false,
    `disclaimerShown` BOOLEAN NOT NULL DEFAULT true,
    `satisfaction` INTEGER NULL,
    `feedbackText` TEXT NULL,
    `llmModel` VARCHAR(191) NULL,
    `promptVersion` VARCHAR(191) NULL,
    `tokensUsed` INTEGER NULL,
    `responseTimeMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `consultations_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    INDEX `consultations_memberId_createdAt_idx`(`memberId`, `createdAt`),
    INDEX `consultations_redLineTriggered_idx`(`redLineTriggered`),
    INDEX `consultations_selfHarmDetected_idx`(`selfHarmDetected`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medication_plans` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `medicineName` VARCHAR(191) NOT NULL,
    `medicineCode` VARCHAR(191) NULL,
    `dosage` VARCHAR(191) NULL,
    `dosageUnit` VARCHAR(191) NULL,
    `frequency` VARCHAR(191) NOT NULL,
    `customSchedule` TEXT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `ocrImageUrl` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `reminderUserId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `medication_plans_memberId_isActive_idx`(`memberId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medication_adherence` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `takenAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `confirmedBy` VARCHAR(191) NULL,
    `missedNotified` BOOLEAN NOT NULL DEFAULT false,
    `missedNotifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `medication_adherence_planId_scheduledAt_idx`(`planId`, `scheduledAt`),
    INDEX `medication_adherence_status_missedNotified_idx`(`status`, `missedNotified`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `metricType` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NULL,
    `inputMethod` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `deviceId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `abnormalStreak` INTEGER NOT NULL DEFAULT 0,
    `abnormalAlerted` BOOLEAN NOT NULL DEFAULT false,
    `recordedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `health_metrics_memberId_metricType_recordedAt_idx`(`memberId`, `metricType`, `recordedAt`),
    INDEX `health_metrics_groupId_idx`(`groupId`),
    INDEX `health_metrics_memberId_metricType_abnormalAlerted_idx`(`memberId`, `metricType`, `abnormalAlerted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metric_thresholds` (
    `id` VARCHAR(191) NOT NULL,
    `metricType` VARCHAR(191) NOT NULL,
    `minNormal` DOUBLE NULL,
    `maxNormal` DOUBLE NULL,
    `alertConsecutiveCount` INTEGER NOT NULL DEFAULT 3,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `metric_thresholds_metricType_key`(`metricType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `actionUrl` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'wechat_subscribe',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `sentAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    INDEX `notifications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge` (
    `id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NULL,
    `content` TEXT NULL,
    `tags` VARCHAR(4000) NOT NULL DEFAULT '[]',
    `coverUrl` VARCHAR(191) NULL,
    `readCount` INTEGER NOT NULL DEFAULT 0,
    `isPublished` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `knowledge_category_isPublished_idx`(`category`, `isPublished`),
    INDEX `knowledge_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_reports` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'periodic',
    `title` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NULL,
    `periodEnd` DATETIME(3) NULL,
    `summary` TEXT NULL,
    `dataJson` TEXT NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `health_reports_memberId_createdAt_idx`(`memberId`, `createdAt`),
    INDEX `health_reports_familyId_createdAt_idx`(`familyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `families` ADD CONSTRAINT `families_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `family_members` ADD CONSTRAINT `family_members_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `family_members` ADD CONSTRAINT `family_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_records` ADD CONSTRAINT `health_records_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `family_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `family_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessments` ADD CONSTRAINT `assessments_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultations` ADD CONSTRAINT `consultations_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `family_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consultations` ADD CONSTRAINT `consultations_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medication_plans` ADD CONSTRAINT `medication_plans_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `family_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medication_plans` ADD CONSTRAINT `medication_plans_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medication_plans` ADD CONSTRAINT `medication_plans_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medication_adherence` ADD CONSTRAINT `medication_adherence_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `medication_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_metrics` ADD CONSTRAINT `health_metrics_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `family_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_reports` ADD CONSTRAINT `health_reports_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `family_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_reports` ADD CONSTRAINT `health_reports_familyId_fkey` FOREIGN KEY (`familyId`) REFERENCES `families`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
