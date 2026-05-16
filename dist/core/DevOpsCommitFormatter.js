"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDevOpsCommitMetadata = formatDevOpsCommitMetadata;
function formatDevOpsCommitMetadata(template, metadata) {
    const message = template
        .replaceAll('${COMMIT_TYPE}', metadata.commitType)
        .replaceAll('${SUBJECT}', metadata.subject)
        .replaceAll('${CODE}', metadata.task.code)
        .replaceAll('${HOURS}', metadata.hours)
        .replaceAll('${PROGRESS}', metadata.progress)
        .replaceAll('${TYPE}', metadata.task.type)
        .replaceAll('${PROJECT}', metadata.project.code);
    return metadata.commitType === 'Merge' ? message.replace(/^Merge:/, 'Merge ') : message;
}
//# sourceMappingURL=DevOpsCommitFormatter.js.map