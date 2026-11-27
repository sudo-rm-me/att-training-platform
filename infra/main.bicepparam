using './main.bicep'

// Values come from environment variables so that secrets never live in the repo.
// The GitHub Actions deploy workflow sets these from repository variables and secrets;
// for a manual deployment, export them in your shell first (see docs/DEPLOY.md).

param namePrefix = readEnvironmentVariable('AZURE_NAME_PREFIX', 'att')
param containerImage = readEnvironmentVariable('CONTAINER_IMAGE', '')

param entraTenantId = readEnvironmentVariable('ENTRA_TENANT_ID')
param entraClientId = readEnvironmentVariable('ENTRA_CLIENT_ID')
param entraClientSecret = readEnvironmentVariable('ENTRA_CLIENT_SECRET')
param authSecret = readEnvironmentVariable('AUTH_SECRET')
param initialAdminEmails = readEnvironmentVariable('INITIAL_ADMIN_EMAILS', '')

param appTimezone = readEnvironmentVariable('APP_TIMEZONE', 'Europe/London')
param minReplicas = int(readEnvironmentVariable('MIN_REPLICAS', '1'))

param postgresAdminPassword = readEnvironmentVariable('POSTGRES_ADMIN_PASSWORD')
