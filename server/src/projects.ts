export interface ProjectMetadata {
  id: string
  name: string
}

export const PROJECTS: ProjectMetadata[] = [
  { id: 'aegis', name: 'Aegis' },
  { id: 'contitech', name: 'ContiTech' },
  { id: 'vdo-fleet', name: 'VDO Fleet' },
  { id: 'contitrade', name: 'ContiTrade' },
]

const projectMap = new Map(PROJECTS.map((project) => [project.id, project]))

export const getProjectMetadata = (projectId: string): ProjectMetadata => {
  return projectMap.get(projectId) || { id: projectId, name: projectId }
}
