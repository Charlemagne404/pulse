export interface ProjectMetadata {
  id: string
  name: string
}

export const formatProjectName = (projectId: string) =>
  projectId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

export const getProjectMetadata = (projectId: string): ProjectMetadata => ({
  id: projectId,
  name: formatProjectName(projectId) || projectId,
})
