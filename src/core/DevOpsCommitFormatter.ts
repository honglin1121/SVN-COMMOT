import { DevOpsCommitMetadata } from './DevOpsProvider';

export function formatDevOpsCommitMetadata(template: string, metadata: DevOpsCommitMetadata): string {
  const resolvedTemplate = /AI/i.test(metadata.workHourTypeName)
    ? template.replace('-h:', '-aih:')
    : template;

  const message = resolvedTemplate
    .replaceAll('${COMMIT_TYPE}', metadata.commitType)
    .replaceAll('${SUBJECT}', metadata.subject)
    .replaceAll('${CODE}', metadata.task.code)
    .replaceAll('${HOURS}', metadata.hours)
    .replaceAll('${PROGRESS}', metadata.progress)
    .replaceAll('${TYPE}', metadata.task.type)
    .replaceAll('${PROJECT}', metadata.project.code);

  return metadata.commitType === 'Merge' ? message.replace(/^Merge:/, 'Merge ') : message;
}
