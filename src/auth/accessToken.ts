let currentAccessToken = ''

export const setAccessToken = (value: string) => {
  currentAccessToken = value.trim()
}

export const clearAccessToken = () => {
  currentAccessToken = ''
}

export const getAccessToken = () => currentAccessToken
